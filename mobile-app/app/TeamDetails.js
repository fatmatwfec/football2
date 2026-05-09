import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
} from 'react-native';

import { useRoute, useNavigation } from '@react-navigation/native';

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
} from 'firebase/firestore';

import { db } from '../firebase';
import { useRouter, useLocalSearchParams, router } from 'expo-router';


import {
    Feather,
    FontAwesome5,
    MaterialIcons,
    Ionicons,
} from '@expo/vector-icons';

const TeamDetails = () => {
    const navigation = useNavigation();

    const { teamId, fromPlayer } = useLocalSearchParams();
    const router = useRouter();

    const [team, setTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [teamStats, setTeamStats] = useState({
        played: 0,
        won: 0,
        lost: 0,
        goals: 0,
    });

    useEffect(() => {
        if (!teamId) {
            console.log('NO TEAM ID');
            return;
        }

        const unsubTeam = onSnapshot(
            doc(db, 'teams', teamId),
            async (snap) => {
                if (snap.exists()) {
                    const data = snap.data();

                    setTeam({
                        id: snap.id,
                        ...data,
                    });

                    if (data.memberIds?.length > 0) {
                        const q = query(
                            collection(db, 'users'),
                            where('uid', 'in', data.memberIds)
                        );

                        const memberSnap = await getDocs(q);

                        const membersList = memberSnap.docs.map((d) => d.data());

                        membersList.sort((a, b) => {
                            if (a.uid === data.captainId) return -1;
                            if (b.uid === data.captainId) return 1;

                            return (a.name || '').localeCompare(b.name || '');
                        });

                        setMembers(membersList);
                    }
                } else {
                    navigation.goBack();
                }

                setLoading(false);
            }
        );

        const fetchStats = async () => {
            const q = query(
                collection(db, 'matches'),
                where('status', '==', 'completed')
            );

            const matchSnap = await getDocs(q);

            let p = 0;
            let w = 0;
            let l = 0;
            let g = 0;

            matchSnap.docs.forEach((docItem) => {
                const m = docItem.data();

                const isTeam1 = m.team1Id === teamId;
                const isTeam2 = m.team2Id === teamId;

                if (isTeam1 || isTeam2) {
                    p++;

                    const scores = (m.score || '0 - 0')
                        .split('-')
                        .map((s) => parseInt(s.trim()));

                    const myScore = isTeam1 ? scores[0] : scores[1];
                    const oppScore = isTeam1 ? scores[1] : scores[0];

                    g += myScore;

                    if (myScore > oppScore) w++;
                    else if (myScore < oppScore) l++;
                }
            });

            setTeamStats({
                played: p,
                won: w,
                lost: l,
                goals: g,
            });
        };

        fetchStats();

        return () => unsubTeam();
    }, [teamId]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00FF9C" />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: 50 }}
            showsVerticalScrollIndicator={false}
        >
            {/* HEADER */}

            <View style={styles.headerBackground}>
                <TouchableOpacity
                    onPress={() => {
                        if (fromPlayer) {
                            router.push({
                                pathname: '/PlayerDetails',
                                params: { playerId: fromPlayer },
                            });
                        } else {
                            router.back();
                        }
                    }}
                >
                    <Text style={{ color: 'white' }}>Back</Text>
                </TouchableOpacity>
            </View>

            {/* TEAM CARD */}

            <View style={styles.teamCard}>
                <View style={styles.teamHeader}>
                    <View style={styles.teamLogo}>
                        <Text style={styles.teamLogoText}>
                            {team?.teamName?.[0]}
                        </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text style={styles.teamName}>
                            {team?.teamName}
                        </Text>

                        <Text style={styles.captainText}>
                            Captained by{' '}
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                {team?.captainName}
                            </Text>
                        </Text>
                    </View>
                </View>

                {/* STATS */}

                <View style={styles.statsGrid}>
                    <StatCard
                        icon="soccer-ball-o"
                        label="Played"
                        value={teamStats.played}
                    />

                    <StatCard
                        icon="trophy"
                        label="Victories"
                        value={teamStats.won}
                    />

                    <StatCard
                        icon="running"
                        label="Defeats"
                        value={teamStats.lost}
                    />

                    <StatCard
                        icon="users"
                        label="Goals"
                        value={teamStats.goals}
                    />
                </View>
            </View>

            {/* MEMBERS */}

            <Text style={styles.sectionTitle}>
                Squad Members
            </Text>

            {members.map((member, i) => (
                <MemberCard
                    key={i}
                    member={member}
                    isCaptain={member.uid === team?.captainId}
                />
            ))}

            {/* TEAM INFO */}

            <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Team Info</Text>

                <InfoRow label="Status" value="Active" />
                <InfoRow label="Region" value="Science Faculty" />

                <InfoRow
                    label="Established"
                    value={
                        team?.createdAt?.toDate
                            ? new Date(
                                team.createdAt.toDate()
                            ).toLocaleDateString()
                            : 'New Team'
                    }
                />
            </View>

            {/* PHILOSOPHY */}

            <View style={styles.quoteCard}>
                <Text style={styles.quoteTitle}>
                    Philosophy
                </Text>

                <Text style={styles.quoteText}>
                    "Our team is built on the spirit of
                    discovery and competition."
                </Text>
            </View>
        </ScrollView>
    );
};

const StatCard = ({ icon, label, value }) => (
    <View style={styles.statCard}>
        <FontAwesome5
            name={icon}
            size={20}
            color="#00FF9C"
        />

        <Text style={styles.statValue}>
            {value}
        </Text>

        <Text style={styles.statLabel}>
            {label}
        </Text>
    </View>
);

const MemberCard = ({ member, isCaptain }) => {
    const navigation = useNavigation();

    return (
        <View style={styles.memberCard}>
            <View style={styles.avatar}>
                {member?.photo ? (
                    <Image source={{ uri: member.photo }} style={styles.img} />
                ) : (
                    <Text style={styles.avatarText}>
                        {member?.name?.[0]}
                    </Text>
                )}
            </View>

            <View style={{ flex: 1 }}>
                <View style={styles.memberTop}>
                    <Text style={styles.memberName}>
                        {member?.name}
                    </Text>

                    {isCaptain && (
                        <View style={styles.captainBadge}>
                            <Text style={styles.captainBadgeText}>
                                Leader
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={() =>
                            router.push({
                                pathname: '/playerDetails',
                                params: {
                                    playerId: member.uid || member.id,
                                },
                            })
                        }
                    >
                        <Feather name="user" size={14} color="#00FF9C" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.positionText}>
                    {member?.position || 'Player'}
                </Text>

                <View style={styles.memberInfoRow}>
                    <View style={styles.smallRow}>
                        <MaterialIcons
                            name="email"
                            size={12}
                            color="#00FF9C"
                        />

                        <Text style={styles.smallText}>
                            {member?.email}
                        </Text>
                    </View>

                    {member?.phone && (
                        <View style={styles.smallRow}>
                            <Ionicons
                                name="call"
                                size={12}
                                color="#3b82f6"
                            />

                            <Text style={styles.smallText}>
                                {member.phone}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>
            {label}
        </Text>

        <Text style={styles.infoValue}>
            {value}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0f16',
    },

    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },

    headerBackground: {
        height: 220,
        backgroundColor: '#111827',
        justifyContent: 'flex-start',
        paddingTop: 50,
        paddingHorizontal: 20,
    },

    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
    },

    backText: {
        color: 'white',
        marginLeft: 8,
        fontWeight: '600',
    },

    teamCard: {
        marginTop: -50,
        marginHorizontal: 16,
        backgroundColor: '#111827',
        borderRadius: 30,
        padding: 20,
    },

    teamHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    teamLogo: {
        width: 90,
        height: 90,
        borderRadius: 24,
        backgroundColor: '#00FF9C',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 18,
    },

    teamLogoText: {
        fontSize: 38,
        fontWeight: '900',
        color: 'black',
    },

    teamName: {
        color: 'white',
        fontSize: 28,
        fontWeight: '900',
    },

    captainText: {
        color: '#9ca3af',
        marginTop: 8,
    },

    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 24,
    },

    statCard: {
        width: '48%',
        backgroundColor: '#0f172a',
        borderRadius: 20,
        padding: 18,
        alignItems: 'center',
        marginBottom: 14,
    },

    statValue: {
        color: 'white',
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 10,
    },

    statLabel: {
        color: '#6b7280',
        marginTop: 4,
        fontSize: 12,
    },

    sectionTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        marginHorizontal: 20,
        marginTop: 26,
        marginBottom: 14,
    },

    memberCard: {
        flexDirection: 'row',
        backgroundColor: '#111827',
        marginHorizontal: 16,
        marginBottom: 14,
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
    },

    avatar: {
        width: 55,
        height: 55,
        borderRadius: 16,
        backgroundColor: '#1f2937',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },

    avatarText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 20,
    },

    memberTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    memberName: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },

    captainBadge: {
        backgroundColor: 'rgba(234,179,8,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },

    captainBadgeText: {
        color: '#facc15',
        fontSize: 10,
        fontWeight: 'bold',
    },

    positionText: {
        color: '#9ca3af',
        marginTop: 4,
        fontSize: 12,
    },

    memberInfoRow: {
        marginTop: 8,
        gap: 6,
    },

    smallRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    smallText: {
        color: '#9ca3af',
        marginLeft: 5,
        fontSize: 11,
    },

    infoCard: {
        backgroundColor: '#111827',
        margin: 16,
        borderRadius: 24,
        padding: 20,
    },

    infoTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 14,
    },

    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },

    infoLabel: {
        color: '#6b7280',
    },

    infoValue: {
        color: 'white',
        fontWeight: 'bold',
    },

    quoteCard: {
        marginHorizontal: 16,
        backgroundColor: 'rgba(0,255,156,0.1)',
        borderRadius: 24,
        padding: 20,
    },

    quoteTitle: {
        color: '#00FF9C',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
    },

    quoteText: {
        color: '#d1d5db',
        fontStyle: 'italic',
        lineHeight: 24,
    },
});

export default TeamDetails;