import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
} from 'react-native';

import { useLocalSearchParams, useRouter, router } from 'expo-router';
import { db } from '../firebase';

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
} from 'firebase/firestore';

import {
    Feather,
    FontAwesome5,
    MaterialIcons,
    Ionicons,
    AntDesign,
} from '@expo/vector-icons';

const PlayerProfile = () => {
    const { playerId } = useLocalSearchParams();
    const router = useRouter();

    const [player, setPlayer] = useState(null);
    const [team, setTeam] = useState(null);
    const [matchHistory, setMatchHistory] = useState([]);
    const [stats, setStats] = useState({
        played: 0,
        won: 0,
        lost: 0,
        drawn: 0,
        goalsScored: 0,
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!playerId) return;

        const fetchData = async () => {
            try {
                let playerData = null;

                const byDoc = await getDoc(doc(db, 'users', playerId));

                if (byDoc.exists()) {
                    playerData = { id: byDoc.id, ...byDoc.data() };
                } else {
                    const q = query(
                        collection(db, 'users'),
                        where('uid', '==', playerId)
                    );

                    const snap = await getDocs(q);

                    if (!snap.empty) {
                        playerData = {
                            id: snap.docs[0].id,
                            ...snap.docs[0].data(),
                        };
                    }
                }

                if (!playerData) return;

                setPlayer(playerData);

                // team
                if (playerData.teamId) {
                    const teamSnap = await getDoc(
                        doc(db, 'teams', playerData.teamId)
                    );

                    if (teamSnap.exists()) {
                        setTeam({
                            id: teamSnap.id,
                            ...teamSnap.data(),
                        });
                    }
                }

                // matches
                if (playerData.teamId) {
                    const matchSnap = await getDocs(
                        query(
                            collection(db, 'matches'),
                            where('status', '==', 'completed')
                        )
                    );

                    let played = 0,
                        won = 0,
                        lost = 0,
                        drawn = 0,
                        goalsScored = 0;

                    const history = [];

                    matchSnap.docs.forEach((d) => {
                        const m = d.data();

                        const isTeam1 = m.team1Id === playerData.teamId;
                        const isTeam2 = m.team2Id === playerData.teamId;

                        if (!isTeam1 && !isTeam2) return;

                        played++;

                        const scores = (m.score || '0-0')
                            .split('-')
                            .map((s) => parseInt(s) || 0);

                        const myScore = isTeam1 ? scores[0] : scores[1];
                        const oppScore = isTeam1 ? scores[1] : scores[0];

                        goalsScored += myScore;

                        let result = 'Draw';

                        if (myScore > oppScore) {
                            won++;
                            result = 'Win';
                        } else if (myScore < oppScore) {
                            lost++;
                            result = 'Loss';
                        } else {
                            drawn++;
                        }

                        history.push({
                            id: d.id,
                            score: m.score,
                            result,
                            date: m.date,
                            myTeam: isTeam1 ? m.team1Name : m.team2Name,
                            opponent: isTeam1 ? m.team2Name : m.team1Name,
                        });
                    });

                    setStats({
                        played,
                        won,
                        lost,
                        drawn,
                        goalsScored,
                    });

                    setMatchHistory(history);
                }
            } catch (err) {
                console.log(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [playerId]);

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#00FF9C" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Feather name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.avatarWrapper}>
                <View style={styles.avatar}>
                    {player?.photo ? (
                        <Image source={{ uri: player.photo }} style={styles.img} />
                    ) : (
                        <Text style={styles.avatarText}>
                            {player?.name?.[0]}
                        </Text>
                    )}
                </View>
            </View>

            {/* PROFILE */}
            <View style={styles.profileBox}>
                <Text style={styles.name}>
                    {player?.name}
                </Text>

                {team && (
                    <TouchableOpacity
                        onPress={() =>
                            router.push({
                                pathname: '/TeamDetails',
                                params: {
                                    teamId: team?.id,
                                    fromPlayer: player?.id, // هنا player موجود عادي
                                },
                            })
                        }
                    >
                        <Text style={styles.team}>
                            🏟 {team.teamName}
                        </Text>
                    </TouchableOpacity>
                )}

                <Text style={styles.email}>
                    {player?.email}
                </Text>
            </View>

            {/* STATS */}
            <View style={styles.statsRow}>
                <Stat label="Played" value={stats.played} />
                <Stat label="Wins" value={stats.won} />
                <Stat label="Loss" value={stats.lost} />
                <Stat label="Goals" value={stats.goalsScored} />
            </View>

            {/* MATCH HISTORY */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Match History</Text>

                {matchHistory.map((m) => (
                    <View key={m.id} style={styles.matchCard}>
                        <Text style={styles.matchText}>
                            {m.myTeam} vs {m.opponent}
                        </Text>

                        <Text style={styles.score}>{m.score}</Text>
                        <Text style={styles.result}>{m.result}</Text>
                    </View>
                ))}
            </View>

        </ScrollView>
    );
};

const Stat = ({ label, value }) => (
    <View style={styles.statBox}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0f16',
    },

    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },

    header: {
        height: 200,
        padding: 20,
        justifyContent: 'flex-end'
    },
    avatarWrapper: {
        alignItems: 'center',
        marginTop: -40,
    },

    avatar: {
        width: 120,
        height: 120,
        borderRadius: 30,
        backgroundColor: '#00FF9C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    img: {
        width: '100%',
        height: '100%',
        borderRadius: 30,
    },

    avatarText: {
        fontSize: 40,
        fontWeight: '900',
        color: 'black',
    },

    profileBox: {
        alignItems: 'center',
        marginTop: 10,
    },

    name: {
        color: 'white',
        fontSize: 28,
        fontWeight: '900',
    },

    team: {
        color: '#00FF9C',
        marginTop: 5,
        fontWeight: 'bold',
    },

    email: {
        color: '#999',
        marginTop: 5,
    },

    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 20,
    },

    statBox: {
        alignItems: 'center',
        backgroundColor: '#111827',
        padding: 15,
        borderRadius: 15,
        width: 80,
    },

    statValue: {
        color: '#00FF9C',
        fontSize: 18,
        fontWeight: 'bold',
    },

    statLabel: {
        color: '#999',
        fontSize: 10,
    },
    section: {
        marginTop: 20,
        padding: 15,
    },

    sectionTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },

    matchCard: {
        backgroundColor: '#111827',
        padding: 15,
        borderRadius: 15,
        marginBottom: 10,
    },

    matchText: {
        color: 'white',
    },

    score: {
        color: '#00FF9C',
        fontWeight: 'bold',
    },

    result: {
        color: '#aaa',
    },
});

export default PlayerProfile;