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
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';

import {
    Feather,
    FontAwesome5,
    MaterialIcons,
    Ionicons,
} from '@expo/vector-icons';

const TeamDetails = () => {
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
        if (!teamId) return;

        const unsubTeam = onSnapshot(
            doc(db, 'teams', teamId),
            async (snap) => {
                if (!snap.exists()) {
                    router.back();
                    return;
                }

                const data = snap.data();

                setTeam({
                    id: snap.id,
                    ...data,
                });

                // MEMBERS
                if (data.memberIds?.length > 0) {
                    try {
                        const q = query(
                            collection(db, 'users'),
                            where('uid', 'in', data.memberIds)
                        );

                        const memberSnap = await getDocs(q);

                        const membersList =
                            memberSnap.docs.map((d) => ({
                                id: d.id,
                                ...d.data(),
                            }));

                        // Leader first
                        membersList.sort((a, b) => {
                            if (a.uid === data.captainId)
                                return -1;

                            if (b.uid === data.captainId)
                                return 1;

                            return (
                                (a.name || '').localeCompare(
                                    b.name || ''
                                )
                            );
                        });

                        setMembers(membersList);
                    } catch (e) {
                        console.log(e);
                    }
                }

                setLoading(false);
            }
        );

        // TEAM STATS
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

                const isTeam1 =
                    m.team1Id === teamId;

                const isTeam2 =
                    m.team2Id === teamId;

                if (!isTeam1 && !isTeam2) return;

                p++;

                const scores = (
                    m.score || '0 - 0'
                )
                    .split('-')
                    .map(
                        (s) =>
                            parseInt(s.trim()) || 0
                    );

                const myScore = isTeam1
                    ? scores[0]
                    : scores[1];

                const oppScore = isTeam1
                    ? scores[1]
                    : scores[0];

                g += myScore;

                if (myScore > oppScore) w++;
                else if (myScore < oppScore)
                    l++;
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
                <ActivityIndicator
                    size="large"
                    color="#00FF9C"
                />
            </View>
        );
    }

    const handleBack = () => {
        if (fromPlayer) {
            router.push({
                pathname: '/playerDetails',
                params: {
                    playerId: fromPlayer,
                },
            });
        } else {
            router.back();
        }
    };

return (
    <>
        <Stack.Screen
            options={{
                headerShown: false,
            }}
        />

        <ScrollView
            style={styles.container}
            contentContainerStyle={{
                paddingBottom: 60,
            }}
            showsVerticalScrollIndicator={false}
        >
            {/* HERO */}
            <View style={styles.hero}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                >
                    <Feather
                        name="arrow-left"
                        size={18}
                        color="#fff"
                    />

                    <Text style={styles.backText}>
                        Back
                    </Text>
                </TouchableOpacity>
            </View>

            {/* MAIN CARD */}
            <View style={styles.teamCard}>
                <View style={styles.teamTop}>
                    <View style={styles.teamLogo}>
                        <Text style={styles.teamLogoText}>
                            {team?.teamName?.[0]}
                        </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                        <View style={styles.teamTitleRow}>
                            <Text style={styles.teamName}>
                                {team?.teamName}
                            </Text>

                            <View style={styles.officialBadge}>
                                <Text
                                    style={
                                        styles.officialBadgeText
                                    }
                                >
                                    Official Team
                                </Text>
                            </View>
                        </View>

                        <View style={styles.captainRow}>
                            <Ionicons
                                name="id-card"
                                size={14}
                                color="#00FF9C"
                            />

                            <Text style={styles.captainText}>
                                Captained by{' '}
                                <Text
                                    style={{
                                        color: '#fff',
                                        fontWeight: '800',
                                    }}
                                >
                                    {team?.captainName}
                                </Text>
                            </Text>
                        </View>

                        <View style={styles.playerBadge}>
                            <Text
                                style={
                                    styles.playerBadgeText
                                }
                            >
                                👥 {members.length} Players
                            </Text>
                        </View>
                    </View>
                </View>

                {/* STATS */}
                <View style={styles.statsGrid}>
                    <StatCard
                        icon="futbol"
                        label="Played"
                        value={teamStats.played}
                        color="#60a5fa"
                    />

                    <StatCard
                        icon="trophy"
                        label="Victories"
                        value={teamStats.won}
                        color="#fbbf24"
                    />

                    <StatCard
                        icon="running"
                        label="Defeats"
                        value={teamStats.lost}
                        color="#ef4444"
                    />

                    <StatCard
                        icon="users"
                        label="Goals"
                        value={teamStats.goals}
                        color="#00FF9C"
                    />
                </View>
            </View>

            {/* MEMBERS */}
            <View style={styles.sectionHeader}>
                <FontAwesome5
                    name="users"
                    size={18}
                    color="#00FF9C"
                />

                <Text style={styles.sectionTitle}>
                    Squad Members
                </Text>
            </View>

            <View style={styles.membersGrid}>
                {members.map((member, i) => (
                    <MemberCard
                        key={member.id || i}
                        member={member}
                        isCaptain={
                            member.uid === team?.captainId
                        }
                        onPress={() =>
                            router.push({
                                pathname:
                                    '/playerDetails',
                                params: {
                                    playerId:
                                        member.uid ||
                                        member.id,
                                    fromTeam:
                                        teamId,
                                },
                            })
                        }
                    />
                ))}
            </View>

            {/* TEAM INFO */}
            <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>
                    📋 Team Info
                </Text>

                <InfoRow
                    label="Status"
                    value="Active"
                    color="#22c55e"
                />

                <InfoRow
                    label="Region"
                    value="Science Faculty"
                />

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

                {team?.neededPositions?.length >
                    0 && (
                    <View style={{ marginTop: 16 }}>
                        <Text style={styles.needTitle}>
                            Needed Positions
                        </Text>

                        <View style={styles.needWrap}>
                            {team.neededPositions.map(
                                (p, i) => (
                                    <View
                                        key={i}
                                        style={
                                            styles.needPill
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.needPillText
                                            }
                                        >
                                            {p}
                                        </Text>
                                    </View>
                                )
                            )}
                        </View>
                    </View>
                )}
            </View>

            {/* PHILOSOPHY */}
            <View style={styles.quoteCard}>
                <Text style={styles.quoteTitle}>
                    Philosophy
                </Text>

                <Text style={styles.quoteText}>
                    "Our team is built on the
                    spirit of discovery and
                    competition. Every match is
                    an experiment in excellence."
                </Text>
            </View>
        </ScrollView>
    </>
);

};

// STAT CARD
const StatCard = ({
    icon,
    label,
    value,
    color,
}) => (
    <View style={styles.statCard}>
        <FontAwesome5
            name={icon}
            size={20}
            color={color}
        />

        <Text
            style={[
                styles.statValue,
                { color },
            ]}
        >
            {value}
        </Text>

        <Text style={styles.statLabel}>
            {label}
        </Text>
    </View>
);

// MEMBER CARD
const MemberCard = ({
    member,
    isCaptain,
    onPress,
}) => {
    return (
        <View style={styles.memberCard}>
            {/* AVATAR */}
            <View style={styles.memberAvatar}>
                {member?.photo ? (
                    <Image
                        source={{
                            uri: member.photo,
                        }}
                        style={styles.memberImg}
                    />
                ) : (
                    <Text
                        style={
                            styles.memberAvatarText
                        }
                    >
                        {member?.name?.[0]}
                    </Text>
                )}
            </View>

            {/* INFO */}
            <View style={{ flex: 1 }}>
                <View
                    style={styles.memberTop}
                >
                    <Text
                        style={
                            styles.memberName
                        }
                    >
                        {member?.name}
                    </Text>

                    {isCaptain && (
                        <View
                            style={
                                styles.leaderBadge
                            }
                        >
                            <Text
                                style={
                                    styles.leaderBadgeText
                                }
                            >
                                Leader
                            </Text>
                        </View>
                    )}
                </View>

                <Text
                    style={
                        styles.memberPosition
                    }
                >
                    {member?.position ||
                        'Player'}
                </Text>

                {/* EMAIL */}
                <View
                    style={styles.memberRow}
                >
                    <MaterialIcons
                        name="email"
                        size={10}
                        color="#00FF9C"
                    />

                    <Text
                        style={
                            styles.memberSmall
                        }
                        numberOfLines={1}
                    >
                        {member?.email ||
                            'No Email'}
                    </Text>
                </View>

                {/* PHONE */}
                {member?.phone && (
                    <View
                        style={
                            styles.memberRow
                        }
                    >
                        <Feather
                            name="phone"
                            size={10}
                            color="#60a5fa"
                        />

                        <Text
                            style={
                                styles.memberSmall
                            }
                        >
                            {member.phone}
                        </Text>
                    </View>
                )}
            </View>

            {/* PROFILE BTN */}
            <TouchableOpacity
                onPress={onPress}
                style={styles.viewBtn}
            >
                <Feather
                    name="external-link"
                    size={12}
                    color="#00FF9C"
                />
            </TouchableOpacity>
        </View>
    );
};

// INFO ROW
const InfoRow = ({
    label,
    value,
    color = '#fff',
}) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>
            {label}
        </Text>

        <Text
            style={[
                styles.infoValue,
                { color },
            ]}
        >
            {value}
        </Text>
    </View>
);

// STYLES
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0f16',
    },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },

    // HERO
    hero: {
        height: 250,
        backgroundColor: '#111827',
        paddingTop: 70,
        paddingHorizontal: 20,
    },

    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        backgroundColor:
            'rgba(0,0,0,0.4)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor:
            'rgba(255,255,255,0.1)',
    },

    backText: {
        color: '#fff',
        fontWeight: '700',
    },

    // TEAM CARD
    teamCard: {
        marginHorizontal: 16,
        marginTop: -80,
        backgroundColor:
            'rgba(17,24,39,0.95)',
        borderRadius: 34,
        padding: 22,
        borderWidth: 1,
        borderColor:
            'rgba(255,255,255,0.08)',
    },

    teamTop: {
        flexDirection: 'row',
        gap: 18,
        marginBottom: 26,
    },

    teamLogo: {
        width: 95,
        height: 95,
        borderRadius: 28,
        backgroundColor: '#00FF9C',
        justifyContent: 'center',
        alignItems: 'center',
    },

    teamLogoText: {
        fontSize: 42,
        fontWeight: '900',
        color: '#000',
    },

    teamTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },

    teamName: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '900',
    },

    officialBadge: {
        backgroundColor:
            'rgba(234,179,8,0.12)',
        borderWidth: 1,
        borderColor:
            'rgba(234,179,8,0.25)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },

    officialBadgeText: {
        color: '#facc15',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
    },

    captainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },

    captainText: {
        color: '#94a3b8',
        fontSize: 13,
    },

    playerBadge: {
        marginTop: 10,
        alignSelf: 'flex-start',
        backgroundColor:
            'rgba(0,255,156,0.1)',
        borderWidth: 1,
        borderColor:
            'rgba(0,255,156,0.2)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },

    playerBadgeText: {
        color: '#00FF9C',
        fontWeight: '800',
        fontSize: 11,
    },

    // STATS
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },

    statCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#0f172a',
        borderRadius: 22,
        padding: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor:
            'rgba(255,255,255,0.05)',
    },

    statValue: {
        fontSize: 28,
        fontWeight: '900',
        marginTop: 10,
    },

    statLabel: {
        color: '#64748b',
        fontSize: 10,
        marginTop: 5,
        fontWeight: '800',
        textTransform: 'uppercase',
    },

    // SECTION
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginHorizontal: 20,
        marginTop: 28,
        marginBottom: 18,
    },

    sectionTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
    },

    // MEMBERS
    membersGrid: {
        paddingHorizontal: 16,
        gap: 14,
    },

    memberCard: {
        backgroundColor: '#111827',
        borderRadius: 24,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor:
            'rgba(255,255,255,0.08)',
    },

    memberAvatar: {
        width: 60,
        height: 60,
        borderRadius: 18,
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
        overflow: 'hidden',
    },

    memberImg: {
        width: '100%',
        height: '100%',
    },

    memberAvatarText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
    },

    memberTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },

    memberName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },

    leaderBadge: {
        backgroundColor:
            'rgba(234,179,8,0.18)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },

    leaderBadgeText: {
        color: '#facc15',
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
    },

    memberPosition: {
        color: '#64748b',
        marginTop: 3,
        fontSize: 12,
    },

    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 4,
    },

    memberSmall: {
        color: '#94a3b8',
        fontSize: 10,
        maxWidth: 150,
    },

    viewBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor:
            'rgba(0,255,156,0.08)',
        borderWidth: 1,
        borderColor:
            'rgba(0,255,156,0.15)',
        marginLeft: 10,
    },

    // INFO CARD
    infoCard: {
        backgroundColor: '#111827',
        marginHorizontal: 16,
        marginTop: 26,
        borderRadius: 28,
        padding: 22,
        borderWidth: 1,
        borderColor:
            'rgba(255,255,255,0.08)',
    },

    infoTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 18,
    },

    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
    },

    infoLabel: {
        color: '#64748b',
        fontWeight: '600',
    },

    infoValue: {
        fontWeight: '800',
    },

    // NEEDS
    needTitle: {
        color: '#64748b',
        marginBottom: 10,
        fontSize: 12,
    },

    needWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },

    needPill: {
        backgroundColor:
            'rgba(167,139,250,0.15)',
        borderWidth: 1,
        borderColor:
            'rgba(167,139,250,0.25)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },

    needPillText: {
        color: '#a78bfa',
        fontWeight: '700',
        fontSize: 11,
    },

    // QUOTE
    quoteCard: {
        marginHorizontal: 16,
        marginTop: 18,
        backgroundColor:
            'rgba(0,255,156,0.08)',
        borderRadius: 28,
        padding: 22,
        borderWidth: 1,
        borderColor:
            'rgba(0,255,156,0.18)',
    },

    quoteTitle: {
        color: '#00FF9C',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 12,
    },

    quoteText: {
        color: '#94a3b8',
        lineHeight: 24,
        fontStyle: 'italic',
    },
});

export default TeamDetails;