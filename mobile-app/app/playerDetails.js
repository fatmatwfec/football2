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

import { useLocalSearchParams, useRouter } from 'expo-router';
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

                // TEAM
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

                // MATCHES
                if (playerData.teamId) {
                    const matchSnap = await getDocs(
                        query(
                            collection(db, 'matches'),
                            where('status', '==', 'completed')
                        )
                    );

                    let played = 0;
                    let won = 0;
                    let lost = 0;
                    let drawn = 0;
                    let goalsScored = 0;

                    const history = [];

                    matchSnap.docs.forEach((d) => {
                        const m = d.data();

                        const isTeam1 =
                            m.team1Id === playerData.teamId;

                        const isTeam2 =
                            m.team2Id === playerData.teamId;

                        if (!isTeam1 && !isTeam2) return;

                        played++;

                        const scores = (m.score || '0-0')
                            .replace(/ /g, '')
                            .split('-')
                            .map((s) => parseInt(s) || 0);

                        const myScore = isTeam1
                            ? scores[0]
                            : scores[1];

                        const oppScore = isTeam1
                            ? scores[1]
                            : scores[0];

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
                            date: m.date,
                            myTeam: isTeam1
                                ? m.team1Name || 'My Team'
                                : m.team2Name || 'My Team',
                            opponent: isTeam1
                                ? m.team2Name || 'Opponent'
                                : m.team1Name || 'Opponent',
                            score: m.score || '0-0',
                            result,
                            tournamentName:
                                m.tournamentName || null,
                        });
                    });

                    history.sort((a, b) =>
                        (b.date || '').localeCompare(a.date || '')
                    );

                    setMatchHistory(history);

                    setStats({
                        played,
                        won,
                        lost,
                        drawn,
                        goalsScored,
                    });
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
                <ActivityIndicator
                    size="large"
                    color="#00FF9C"
                />
            </View>
        );
    }

    const isSuspended =
        !!player?.suspendedForNextMatch;

    const suspendReason =
        player?.suspendReason;

    const isCaptain =
        player?.uid === team?.captainId;

    const winRate =
        stats.played > 0
            ? `${Math.round(
                  (stats.won / stats.played) * 100
              )}%`
            : '—';

    const goalsPerGame =
        stats.played > 0
            ? (
                  stats.goalsScored /
                  stats.played
              ).toFixed(1)
            : '—';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{
                paddingBottom: 60,
            }}
        >
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => router.back()}
                >
                    <Feather
                        name="arrow-left"
                        size={20}
                        color="#fff"
                    />
                    <Text style={styles.backText}>
                        Back
                    </Text>
                </TouchableOpacity>
            </View>

            {/* AVATAR */}
            <View style={styles.avatarWrapper}>
                <View
                    style={[
                        styles.avatar,
                        isSuspended &&
                            styles.avatarSuspended,
                    ]}
                >
                    {player?.photo ? (
                        <Image
                            source={{
                                uri: player.photo,
                            }}
                            style={styles.img}
                        />
                    ) : (
                        <Text style={styles.avatarText}>
                            {player?.name?.[0]}
                        </Text>
                    )}
                </View>

                {isSuspended && (
                    <View style={styles.suspendedBanner}>
                        <Text
                            style={
                                styles.suspendedBannerText
                            }
                        >
                            {suspendReason === 'red'
                                ? '🟥 BANNED — Red Card'
                                : '🟨 SUSPENDED — Yellow Cards'}
                        </Text>
                    </View>
                )}
            </View>

            {/* PLAYER INFO */}
            <View style={styles.profileBox}>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <Text style={styles.name}>
                        {player?.name}
                    </Text>

                    {isCaptain && (
                        <View style={styles.leaderBadge}>
                            <Text
                                style={
                                    styles.leaderBadgeText
                                }
                            >
                                ⭐ Leader
                            </Text>
                        </View>
                    )}
                </View>

                {player?.position && (
                    <View style={styles.positionBadge}>
                        <Text
                            style={
                                styles.positionBadgeText
                            }
                        >
                            {player.position}
                        </Text>
                    </View>
                )}

                {team && (
                    <TouchableOpacity
                        style={styles.teamBadge}
                        onPress={() =>
                            router.push({
                                pathname:
                                    '/TeamDetails',
                                params: {
                                    teamId:
                                        team?.id,
                                },
                            })
                        }
                    >
                        <Text
                            style={
                                styles.teamBadgeText
                            }
                        >
                            🏟️ {team.teamName}
                        </Text>
                    </TouchableOpacity>
                )}

                <Text style={styles.email}>
                    {player?.email}
                </Text>

                {player?.phone && (
                    <Text style={styles.phone}>
                        📞 {player.phone}
                    </Text>
                )}

                {player?.studentCode && (
                    <Text style={styles.studentCode}>
                        ID: {player.studentCode}
                    </Text>
                )}
            </View>

            {/* STATS */}
            <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>
                    ⚡ MATCH STATS
                </Text>

                <View style={styles.statsGrid}>
                    <StatBox
                        label="Played"
                        value={stats.played}
                        color="#60a5fa"
                    />

                    <StatBox
                        label="Wins"
                        value={stats.won}
                        color="#00FF9C"
                    />

                    <StatBox
                        label="Losses"
                        value={stats.lost}
                        color="#ef4444"
                    />

                    <StatBox
                        label="Draws"
                        value={stats.drawn}
                        color="#cbd5e1"
                    />

                    <StatBox
                        label="Goals"
                        value={
                            stats.goalsScored
                        }
                        color="#fbbf24"
                    />
                </View>
            </View>

            {/* PERFORMANCE */}
            <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>
                    🛡 PERFORMANCE
                </Text>

                <PerfRow
                    label="Win Rate"
                    value={winRate}
                    valueColor="#00FF9C"
                />

                <PerfRow
                    label="Goals / Game"
                    value={goalsPerGame}
                    valueColor="#60a5fa"
                />

                <PerfRow
                    label="Team Status"
                    value={
                        player?.hasTeam
                            ? 'In Team'
                            : 'Free Agent'
                    }
                    valueColor={
                        player?.hasTeam
                            ? '#00FF9C'
                            : '#f59e0b'
                    }
                />

                <PerfRow
                    label="Role"
                    value={
                        isCaptain
                            ? 'Team Leader'
                            : 'Player'
                    }
                    valueColor={
                        isCaptain
                            ? '#fbbf24'
                            : '#fff'
                    }
                />
            </View>

            {/* DISCIPLINE */}
            <View
                style={[
                    styles.sectionCard,
                    isSuspended &&
                        styles.sectionCardDanger,
                ]}
            >
                <Text style={styles.sectionLabel}>
                    🟨 DISCIPLINE
                </Text>

                <View style={styles.disciplineRow}>
                    <View style={styles.cardStatBox}>
                        <View
                            style={
                                styles.yellowCardIcon
                            }
                        />

                        <Text
                            style={[
                                styles.cardCount,
                                {
                                    color:
                                        '#fbbf24',
                                },
                            ]}
                        >
                            {player?.yellowCards ||
                                0}
                        </Text>

                        <Text
                            style={
                                styles.cardLabel
                            }
                        >
                            Yellow Cards
                        </Text>
                    </View>

                    <View
                        style={
                            styles.disciplineDivider
                        }
                    />

                    <View style={styles.cardStatBox}>
                        <View
                            style={
                                styles.redCardIcon
                            }
                        />

                        <Text
                            style={[
                                styles.cardCount,
                                {
                                    color:
                                        '#ef4444',
                                },
                            ]}
                        >
                            {player?.redCards ||
                                0}
                        </Text>

                        <Text
                            style={
                                styles.cardLabel
                            }
                        >
                            Red Cards
                        </Text>
                    </View>
                </View>
            </View>

            {/* ACCOUNT */}
            <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>
                    👤 ACCOUNT
                </Text>

                <PerfRow
                    label="Student ID"
                    value={
                        player?.studentCode ||
                        '—'
                    }
                />

                <PerfRow
                    label="Faculty"
                    value="Science"
                />
            </View>

            {/* TOURNAMENT STATS */}
            {player?.tournamentStats &&
                Object.keys(
                    player.tournamentStats
                ).length > 0 && (
                    <View style={styles.sectionCard}>
                        <Text
                            style={
                                styles.sectionLabel
                            }
                        >
                            🏆 TOURNAMENT BREAKDOWN
                        </Text>

                        {Object.entries(
                            player.tournamentStats
                        ).map(
                            ([name, tStats]) => (
                                <View
                                    key={name}
                                    style={
                                        styles.tournamentStatRow
                                    }
                                >
                                    <Text
                                        style={
                                            styles.tournamentName
                                        }
                                    >
                                        {name}
                                    </Text>

                                    <View
                                        style={
                                            styles.tournamentStatPills
                                        }
                                    >
                                        <View
                                            style={
                                                styles.tPill
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.tPillVal
                                                }
                                            >
                                                {tStats.goals ||
                                                    0}
                                            </Text>

                                            <Text
                                                style={
                                                    styles.tPillLabel
                                                }
                                            >
                                                ⚽
                                            </Text>
                                        </View>

                                        <View
                                            style={[
                                                styles.tPill,
                                                {
                                                    borderColor:
                                                        'rgba(251,191,36,0.3)',
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.tPillVal,
                                                    {
                                                        color:
                                                            '#fbbf24',
                                                    },
                                                ]}
                                            >
                                                {tStats.yellow ||
                                                    0}
                                            </Text>

                                            <Text
                                                style={
                                                    styles.tPillLabel
                                                }
                                            >
                                                🟨
                                            </Text>
                                        </View>

                                        <View
                                            style={[
                                                styles.tPill,
                                                {
                                                    borderColor:
                                                        'rgba(239,68,68,0.3)',
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.tPillVal,
                                                    {
                                                        color:
                                                            '#ef4444',
                                                    },
                                                ]}
                                            >
                                                {tStats.red ||
                                                    0}
                                            </Text>

                                            <Text
                                                style={
                                                    styles.tPillLabel
                                                }
                                            >
                                                🟥
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )
                        )}
                    </View>
                )}

            {/* MATCH HISTORY */}
            <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>
                    📋 MATCH HISTORY
                </Text>

                {matchHistory.length === 0 ? (
                    <Text
                        style={{
                            color: '#64748b',
                            textAlign: 'center',
                            paddingVertical: 20,
                        }}
                    >
                        No completed matches yet
                    </Text>
                ) : (
                    matchHistory.map((m) => {
                        const resultColor =
                            m.result === 'Win'
                                ? '#00FF9C'
                                : m.result ===
                                  'Loss'
                                ? '#ef4444'
                                : '#60a5fa';

                        return (
                            <View
                                key={m.id}
                                style={
                                    styles.matchCard
                                }
                            >
                                <View
                                    style={[
                                        styles.resultBar,
                                        {
                                            backgroundColor:
                                                resultColor,
                                        },
                                    ]}
                                />

                                <View
                                    style={{
                                        flex: 1,
                                    }}
                                >
                                    <Text
                                        style={
                                            styles.matchTeams
                                        }
                                    >
                                        {m.myTeam}{' '}
                                        <Text
                                            style={{
                                                color:
                                                    '#64748b',
                                            }}
                                        >
                                            vs
                                        </Text>{' '}
                                        {
                                            m.opponent
                                        }
                                    </Text>

                                    <Text
                                        style={
                                            styles.matchDate
                                        }
                                    >
                                        {m.date ||
                                            '—'}
                                    </Text>

                                    {m.tournamentName && (
                                        <Text
                                            style={
                                                styles.tournamentMini
                                            }
                                        >
                                            {
                                                m.tournamentName
                                            }
                                        </Text>
                                    )}
                                </View>

                                <View
                                    style={
                                        styles.matchRight
                                    }
                                >
                                    <Text
                                        style={
                                            styles.matchScore
                                        }
                                    >
                                        {m.score}
                                    </Text>

                                    <Text
                                        style={[
                                            styles.matchResult,
                                            {
                                                color:
                                                    resultColor,
                                            },
                                        ]}
                                    >
                                        {m.result}
                                    </Text>
                                </View>
                            </View>
                        );
                    })
                )}
            </View>
        </ScrollView>
    );
};

// COMPONENTS
const StatBox = ({
    label,
    value,
    color,
}) => (
    <View style={styles.statBox}>
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

const PerfRow = ({
    label,
    value,
    valueColor = '#fff',
}) => (
    <View style={styles.perfRow}>
        <Text style={styles.perfLabel}>
            {label}
        </Text>

        <Text
            style={[
                styles.perfValue,
                {
                    color: valueColor,
                },
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

    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },

    header: {
        height: 210,
        backgroundColor: '#111827',
        justifyContent: 'flex-end',
        paddingBottom: 20,
        paddingHorizontal: 20,
    },

    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        backgroundColor:
            'rgba(255,255,255,0.08)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
    },

    backText: {
        color: '#fff',
        fontWeight: '700',
    },

    avatarWrapper: {
        alignItems: 'center',
        marginTop: -60,
        gap: 12,
    },

    avatar: {
        width: 120,
        height: 120,
        borderRadius: 30,
        backgroundColor: '#00FF9C',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#0a0f16',
        overflow: 'hidden',
    },

    avatarSuspended: {
        borderColor: '#ef4444',
    },

    img: {
        width: '100%',
        height: '100%',
    },

    avatarText: {
        fontSize: 42,
        fontWeight: '900',
        color: '#000',
    },

    suspendedBanner: {
        backgroundColor:
            'rgba(239,68,68,0.15)',
        borderWidth: 1,
        borderColor:
            'rgba(239,68,68,0.3)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },

    suspendedBannerText: {
        color: '#ef4444',
        fontWeight: '800',
        fontSize: 11,
    },

    profileBox: {
        alignItems: 'center',
        paddingTop: 14,
        gap: 8,
        paddingHorizontal: 20,
    },

    name: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '900',
    },

    leaderBadge: {
        backgroundColor:
            'rgba(251,191,36,0.12)',
        borderWidth: 1,
        borderColor:
            'rgba(251,191,36,0.3)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },

    leaderBadgeText: {
        color: '#fbbf24',
        fontWeight: '800',
        fontSize: 10,
    },

    positionBadge: {
        backgroundColor:
            'rgba(255,255,255,0.06)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },

    positionBadgeText: {
        color: '#cbd5e1',
        fontWeight: '700',
        fontSize: 12,
    },

    teamBadge: {
        backgroundColor:
            'rgba(0,255,156,0.12)',
        borderWidth: 1,
        borderColor:
            'rgba(0,255,156,0.25)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },

    teamBadgeText: {
        color: '#00FF9C',
        fontWeight: '800',
        fontSize: 13,
    },

    email: {
        color: '#94a3b8',
        fontSize: 12,
    },

    phone: {
        color: '#60a5fa',
        fontSize: 12,
    },

    studentCode: {
        color: '#64748b',
        fontSize: 11,
    },

    sectionCard: {
        backgroundColor: '#111827',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor:
            'rgba(255,255,255,0.07)',
    },

    sectionCardDanger: {
        borderColor:
            'rgba(239,68,68,0.3)',
    },

    sectionLabel: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '900',
        marginBottom: 14,
        letterSpacing: 1.5,
    },

    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },

    statBox: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#0f172a',
        borderRadius: 18,
        padding: 16,
        alignItems: 'center',
    },

    statValue: {
        fontSize: 28,
        fontWeight: '900',
    },

    statLabel: {
        color: '#64748b',
        marginTop: 4,
        fontSize: 11,
    },

    perfRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
    },

    perfLabel: {
        color: '#64748b',
        fontWeight: '700',
    },

    perfValue: {
        fontWeight: '900',
    },

    disciplineRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    cardStatBox: {
        flex: 1,
        alignItems: 'center',
        gap: 6,
    },

    disciplineDivider: {
        width: 1,
        height: 80,
        backgroundColor:
            'rgba(255,255,255,0.08)',
    },

    yellowCardIcon: {
        width: 28,
        height: 36,
        backgroundColor: '#fbbf24',
        borderRadius: 5,
    },

    redCardIcon: {
        width: 28,
        height: 36,
        backgroundColor: '#ef4444',
        borderRadius: 5,
    },

    cardCount: {
        fontSize: 30,
        fontWeight: '900',
    },

    cardLabel: {
        color: '#64748b',
        fontSize: 11,
    },

    tournamentStatRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor:
            'rgba(255,255,255,0.05)',
    },

    tournamentName: {
        color: '#fff',
        fontWeight: '700',
        flex: 1,
    },

    tournamentStatPills: {
        flexDirection: 'row',
        gap: 8,
    },

    tPill: {
        alignItems: 'center',
        backgroundColor:
            'rgba(0,255,156,0.07)',
        borderWidth: 1,
        borderColor:
            'rgba(0,255,156,0.2)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        minWidth: 44,
    },

    tPillVal: {
        color: '#00FF9C',
        fontWeight: '900',
        fontSize: 16,
    },

    tPillLabel: {
        fontSize: 10,
    },

    matchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        overflow: 'hidden',
    },

    resultBar: {
        width: 4,
        height: '100%',
        marginRight: 12,
        borderRadius: 4,
        minHeight: 44,
    },

    matchTeams: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 13,
    },

    matchDate: {
        color: '#64748b',
        fontSize: 10,
        marginTop: 3,
    },

    tournamentMini: {
        color: '#00FF9C',
        fontSize: 9,
        marginTop: 4,
        fontWeight: '800',
        textTransform: 'uppercase',
    },

    matchRight: {
        alignItems: 'flex-end',
    },

    matchScore: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 18,
    },

    matchResult: {
        fontSize: 10,
        fontWeight: '800',
        marginTop: 3,
    },
});

export default PlayerProfile;