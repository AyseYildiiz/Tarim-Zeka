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

interface SavingsData {
    totalSaved: number;
    waterSaved: number;
    fertilizerSaved: number;
    energySaved: number;
}

export default function SavingsScreen() {
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
            console.error('Savings fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSavings();
        setRefreshing(false);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16A34A" />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Tasarruf Özeti</Text>
            </View>

            <View style={styles.totalCard}>
                <Ionicons name="wallet-outline" size={48} color="#16A34A" />
                <Text style={styles.totalAmount}>₺{savings?.totalSaved || 0}</Text>
                <Text style={styles.totalLabel}>Toplam Tasarruf</Text>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Ionicons name="water-outline" size={32} color="#3B82F6" />
                    <Text style={styles.statValue}>{savings?.waterSaved || 0} L</Text>
                    <Text style={styles.statLabel}>Su Tasarrufu</Text>
                </View>

                <View style={styles.statCard}>
                    <Ionicons name="leaf-outline" size={32} color="#16A34A" />
                    <Text style={styles.statValue}>{savings?.fertilizerSaved || 0} kg</Text>
                    <Text style={styles.statLabel}>Gübre Tasarrufu</Text>
                </View>

                <View style={styles.statCard}>
                    <Ionicons name="flash-outline" size={32} color="#F59E0B" />
                    <Text style={styles.statValue}>{savings?.energySaved || 0} kWh</Text>
                    <Text style={styles.statLabel}>Enerji Tasarrufu</Text>
                </View>
            </View>

            <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={24} color="#94a3b8" />
                <Text style={styles.infoText}>
                    Tasarruf verileri, tarla aktivitelerinize göre hesaplanmaktadır.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
    },
    header: {
        padding: 20,
        paddingTop: 60,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    totalCard: {
        backgroundColor: '#1e293b',
        margin: 20,
        padding: 30,
        borderRadius: 16,
        alignItems: 'center',
    },
    totalAmount: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#16A34A',
        marginTop: 12,
    },
    totalLabel: {
        fontSize: 16,
        color: '#94a3b8',
        marginTop: 4,
    },
    statsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        gap: 8,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
        textAlign: 'center',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        margin: 20,
        padding: 16,
        borderRadius: 12,
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#94a3b8',
    },
});