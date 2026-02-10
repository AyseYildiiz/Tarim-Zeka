import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config';
import { useTheme } from '../../context/ThemeContext';

interface SavingsData {
    totalWaterSaved: number;
    totalMoneySaved: number;
    savingPercentage: number;
    totalSmartWater: number;
    totalTraditionalWater: number;
    potentialWaterSaved?: number;
    potentialMoneySaved?: number;
    potentialSmartWater?: number;
    potentialTraditionalWater?: number;
    weeklyStats: { week: string; waterSaved: number }[];
    monthlyStats: { month: string; waterSaved: number }[];
    totalFieldArea: number;
    fieldCount: number;
    completedIrrigations: number;
    totalSchedules?: number;
    comparisonNote: string;
}

export default function SavingsScreen() {
    const { colors } = useTheme();
    const [savings, setSavings] = useState<SavingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadSavings();
    }, []);

    const loadSavings = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${API_URL}/savings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSavings(data);
            }
        } catch (error) {

        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSavings();
        setRefreshing(false);
    };

    const formatWater = (liters: number): string => {
        if (liters >= 1000000) return `${(liters / 1000000).toFixed(1)} Milyon L`;
        if (liters >= 1000) return `${(liters / 1000).toFixed(1)} Bin L`;
        return `${Math.round(liters)} L`;
    };

    // İki değeri aynı birimde göstermek için
    const formatWaterPair = (value1: number, value2: number): [string, string] => {
        const maxValue = Math.max(value1, value2);
        if (maxValue >= 1000000) {
            return [
                `${(value1 / 1000000).toFixed(1)} Milyon L`,
                `${(value2 / 1000000).toFixed(1)} Milyon L`
            ];
        }
        if (maxValue >= 1000) {
            return [
                `${(value1 / 1000).toFixed(1)} Bin L`,
                `${(value2 / 1000).toFixed(1)} Bin L`
            ];
        }
        return [`${Math.round(value1)} L`, `${Math.round(value2)} L`];
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color="#16A34A" />
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>💧 Tasarruf Özeti</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                    {savings?.comparisonNote || 'Akıllı sulama ile tasarruf'}
                </Text>
            </View>

            {/* Ana Tasarruf Kartı */}
            <View style={[styles.totalCard, { backgroundColor: colors.surface }]}>
                <View style={styles.percentageCircle}>
                    <Text style={styles.percentageText}>%{savings?.savingPercentage || 0}</Text>
                </View>
                {(savings?.totalMoneySaved || 0) > 0 ? (
                    <>
                        <Text style={[styles.totalAmount, { color: colors.primary }]}>
                            ₺{(savings?.totalMoneySaved || 0).toFixed(2)}
                        </Text>
                        <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Gerçek Para Tasarrufu</Text>
                        <Text style={[styles.waterSaved, { color: colors.text }]}>
                            {formatWater(savings?.totalWaterSaved || 0)} su tasarrufu
                        </Text>
                    </>
                ) : (
                    <>
                        <Text style={[styles.totalAmount, { color: '#F59E0B' }]}>
                            ₺{(savings?.potentialMoneySaved || 0).toFixed(2)}
                        </Text>
                        <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Potansiyel Tasarruf</Text>
                        <Text style={[styles.waterSaved, { color: colors.text }]}>
                            {formatWater(savings?.potentialWaterSaved || 0)} su tasarrufu potansiyeli
                        </Text>
                        <Text style={[styles.potentialNote, { color: colors.textTertiary }]}>
                            Sulamalar tamamlandıkça güncellenir
                        </Text>
                    </>
                )}
            </View>

            {/* Karşılaştırma */}
            <View style={[styles.comparisonCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>📊 Karşılaştırma</Text>
                <Text style={[styles.comparisonNote, { color: colors.textSecondary }]}>
                    {savings?.comparisonNote || ''}
                </Text>
                {(() => {
                    const smartWater = savings?.completedIrrigations && savings.completedIrrigations > 0
                        ? savings.totalSmartWater || 0
                        : savings?.potentialSmartWater || 0;
                    const traditionalWater = savings?.completedIrrigations && savings.completedIrrigations > 0
                        ? savings.totalTraditionalWater || 0
                        : savings?.potentialTraditionalWater || 0;
                    const [smartFormatted, traditionalFormatted] = formatWaterPair(smartWater, traditionalWater);

                    return (
                        <View style={styles.comparisonRow}>
                            <View style={styles.comparisonItem}>
                                <Ionicons name="water" size={24} color="#3B82F6" />
                                <Text style={[styles.comparisonValue, { color: colors.text }]}>
                                    {smartFormatted}
                                </Text>
                                <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Akıllı Sulama</Text>
                            </View>
                            <View style={styles.vsContainer}>
                                <Text style={[styles.vsText, { color: colors.textTertiary }]}>vs</Text>
                            </View>
                            <View style={styles.comparisonItem}>
                                <Ionicons name="water-outline" size={24} color="#EF4444" />
                                <Text style={[styles.comparisonValue, { color: colors.text }]}>
                                    {traditionalFormatted}
                                </Text>
                                <Text style={[styles.comparisonLabel, { color: colors.textSecondary }]}>Geleneksel</Text>
                            </View>
                        </View>
                    );
                })()}
            </View>

            {/* İstatistikler */}
            <View style={styles.statsContainer}>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                    <Ionicons name="leaf" size={28} color="#16A34A" />
                    <Text style={[styles.statValue, { color: colors.text }]}>{savings?.fieldCount || 0}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tarla</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                    <Ionicons name="checkmark-circle" size={28} color="#3B82F6" />
                    <Text style={[styles.statValue, { color: colors.text }]}>{savings?.completedIrrigations || 0}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sulama</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                    <Ionicons name="resize" size={28} color="#F59E0B" />
                    <Text style={[styles.statValue, { color: colors.text }]}>{savings?.totalFieldArea || 0}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Dönüm</Text>
                </View>
            </View>

            {/* Haftalık İstatistik */}
            {savings?.weeklyStats && savings.weeklyStats.length > 0 && (
                <View style={[styles.chartCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Haftalık Tasarruf</Text>
                    {savings.weeklyStats.slice(-4).map((stat, index) => (
                        <View key={index} style={styles.chartRow}>
                            <Text style={[styles.chartLabel, { color: colors.textSecondary }]}>{stat.week}</Text>
                            <View style={styles.chartBarContainer}>
                                <View
                                    style={[
                                        styles.chartBar,
                                        {
                                            width: `${Math.min(100, (stat.waterSaved / Math.max(...savings.weeklyStats.map(s => s.waterSaved))) * 100)}%`,
                                            backgroundColor: colors.primary
                                        }
                                    ]}
                                />
                            </View>
                            <Text style={[styles.chartValue, { color: colors.text }]}>{formatWater(stat.waterSaved)}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    Tasarruf, AI destekli akıllı sulama ile geleneksel sulama yöntemlerinin karşılaştırılmasıyla hesaplanır.
                </Text>
            </View>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        padding: 20,
        paddingTop: 60,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    totalCard: {
        margin: 20,
        marginTop: 0,
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
    },
    percentageCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#16A34A20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    percentageText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#16A34A',
    },
    totalAmount: {
        fontSize: 36,
        fontWeight: 'bold',
    },
    totalLabel: {
        fontSize: 14,
        marginTop: 4,
    },
    waterSaved: {
        fontSize: 16,
        marginTop: 8,
        fontWeight: '500',
    },
    potentialNote: {
        fontSize: 12,
        marginTop: 6,
        fontStyle: 'italic',
    },
    comparisonCard: {
        margin: 20,
        marginTop: 0,
        padding: 16,
        borderRadius: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 6,
    },
    comparisonNote: {
        fontSize: 12,
        marginBottom: 12,
        fontStyle: 'italic',
    },
    comparisonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    comparisonItem: {
        flex: 1,
        alignItems: 'center',
    },
    comparisonValue: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 4,
    },
    comparisonLabel: {
        fontSize: 12,
        marginTop: 2,
    },
    vsContainer: {
        paddingHorizontal: 12,
    },
    vsText: {
        fontSize: 14,
        fontWeight: '500',
    },
    statsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        gap: 8,
    },
    statCard: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 11,
        marginTop: 4,
        textAlign: 'center',
    },
    chartCard: {
        margin: 20,
        padding: 16,
        borderRadius: 12,
    },
    chartRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    chartLabel: {
        width: 70,
        fontSize: 12,
    },
    chartBarContainer: {
        flex: 1,
        height: 16,
        backgroundColor: '#1e293b40',
        borderRadius: 8,
        marginHorizontal: 8,
        overflow: 'hidden',
    },
    chartBar: {
        height: '100%',
        borderRadius: 8,
    },
    chartValue: {
        width: 60,
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'right',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 20,
        padding: 16,
        borderRadius: 12,
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
    },
});
