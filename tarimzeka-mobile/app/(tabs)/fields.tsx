import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../../config';

interface Field {
    id: string;
    name: string;
    location: string;
    soilType: string;
    cropType: string;
    area?: number;
    createdAt: string;
}

export default function FieldsScreen() {
    const router = useRouter();
    const [fields, setFields] = useState<Field[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Sayfa odağa geldiğinde verileri yenile
    useFocusEffect(
        useCallback(() => {
            loadFields();
        }, [])
    );

    const loadFields = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${API_URL}/fields`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setFields(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Load fields error:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteField = async (fieldId: string, fieldName: string) => {
        Alert.alert(
            'Tarla Sil',
            `"${fieldName}" tarlasını silmek istediğinizden emin misiniz?`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('token');
                            const response = await fetch(`${API_URL}/fields/${fieldId}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });

                            if (response.ok) {
                                setFields(prev => prev.filter(f => f.id !== fieldId));
                            } else {
                                Alert.alert('Hata', 'Tarla silinemedi');
                            }
                        } catch (error) {
                            console.error('Delete field error:', error);
                            Alert.alert('Hata', 'Bağlantı hatası');
                        }
                    }
                }
            ]
        );
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadFields();
        setRefreshing(false);
    };

    const getSoilIcon = (soilType: string) => {
        switch (soilType) {
            case 'Killi': return '🟤';
            case 'Kumlu': return '🟡';
            case 'Tınlı': return '🟠';
            case 'Balçık': return '⚫';
            case 'Bilmiyorum': return '❓';
            default: return '🟤';
        }
    };

    const getCropIcon = (cropType: string) => {
        switch (cropType) {
            case 'Buğday': return '🌾';
            case 'Mısır': return '🌽';
            case 'Domates': return '🍅';
            case 'Biber': return '🌶️';
            case 'Patates': return '🥔';
            case 'Üzüm': return '🍇';
            case 'Zeytin': return '🫒';
            case 'Ayçiçeği': return '🌻';
            case 'Pamuk': return '☁️';
            case 'Elma': return '🍎';
            default: return '🌱';
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16A34A" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>🌾 Tarlalarım</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => router.push('/add-field' as any)}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{fields.length}</Text>
                    <Text style={styles.statLabel}>Toplam Tarla</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                        {fields.reduce((sum, f) => sum + (f.area || 0), 0)}
                    </Text>
                    <Text style={styles.statLabel}>Toplam Dönüm</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                        {new Set(fields.map(f => f.cropType)).size}
                    </Text>
                    <Text style={styles.statLabel}>Ürün Çeşidi</Text>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {fields.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="leaf-outline" size={64} color="#64748b" />
                        <Text style={styles.emptyStateTitle}>Henüz tarla eklemediniz</Text>
                        <Text style={styles.emptyStateText}>
                            Sulama önerilerini görmek için tarla ekleyin
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyStateButton}
                            onPress={() => router.push('/add-field' as any)}
                        >
                            <Ionicons name="add-circle" size={20} color="#fff" />
                            <Text style={styles.emptyStateButtonText}>Tarla Ekle</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    fields.map((field) => (
                        <View key={field.id} style={styles.fieldCard}>
                            <View style={styles.fieldHeader}>
                                <View style={styles.fieldTitleRow}>
                                    <Text style={styles.cropIcon}>{getCropIcon(field.cropType)}</Text>
                                    <View style={styles.fieldTitleContent}>
                                        <Text style={styles.fieldName}>{field.name}</Text>
                                        <View style={styles.locationRow}>
                                            <Ionicons name="location-outline" size={14} color="#64748b" />
                                            <Text style={styles.fieldLocation}>
                                                {field.location || 'Konum belirtilmedi'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.headerActions}>
                                    <TouchableOpacity
                                        style={styles.editButton}
                                        onPress={() => router.push(`/edit-field?id=${field.id}` as any)}
                                    >
                                        <Ionicons name="pencil" size={18} color="#3B82F6" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => deleteField(field.id, field.name)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.fieldDetails}>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailIcon}>{getSoilIcon(field.soilType)}</Text>
                                    <View>
                                        <Text style={styles.detailLabel}>Toprak</Text>
                                        <Text style={[
                                            styles.detailValue,
                                            field.soilType === 'Bilmiyorum' && styles.detailValueUnknown
                                        ]}>
                                            {field.soilType}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.detailItem}>
                                    <Text style={styles.detailIcon}>🌱</Text>
                                    <View>
                                        <Text style={styles.detailLabel}>Ürün</Text>
                                        <Text style={styles.detailValue}>{field.cropType}</Text>
                                    </View>
                                </View>

                                {field.area && (
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailIcon}>📐</Text>
                                        <View>
                                            <Text style={styles.detailLabel}>Alan</Text>
                                            <Text style={styles.detailValue}>{field.area} dönüm</Text>
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Toprak bilinmiyor uyarısı */}
                            {field.soilType === 'Bilmiyorum' && (
                                <TouchableOpacity
                                    style={styles.soilWarning}
                                    onPress={() => router.push('/soil-analysis' as any)}
                                >
                                    <Ionicons name="information-circle" size={18} color="#F59E0B" />
                                    <Text style={styles.soilWarningText}>
                                        Toprak türünü belirlemek için analiz yapın
                                    </Text>
                                    <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
                                </TouchableOpacity>
                            )}

                            {/* Quick Actions */}
                            <View style={styles.fieldActions}>
                                <TouchableOpacity style={styles.fieldAction}>
                                    <Ionicons name="water" size={18} color="#3B82F6" />
                                    <Text style={styles.fieldActionText}>Sula</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.fieldAction}
                                    onPress={() => router.push('/(tabs)/calendar' as any)}
                                >
                                    <Ionicons name="calendar" size={18} color="#16A34A" />
                                    <Text style={styles.fieldActionText}>Takvim</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.fieldAction}
                                    onPress={() => router.push('/soil-analysis' as any)}
                                >
                                    <Ionicons name="analytics" size={18} color="#F59E0B" />
                                    <Text style={styles.fieldActionText}>Analiz</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#16A34A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#1e293b',
        marginHorizontal: 20,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        backgroundColor: '#334155',
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 20,
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
        marginTop: 40,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#94a3b8',
        marginTop: 16,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center',
    },
    emptyStateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#16A34A',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 24,
    },
    emptyStateButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    fieldCard: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    fieldHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    fieldTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    fieldTitleContent: {
        flex: 1,
    },
    cropIcon: {
        fontSize: 32,
    },
    fieldName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    fieldLocation: {
        fontSize: 13,
        color: '#64748b',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    editButton: {
        padding: 8,
        backgroundColor: '#1e3a5f',
        borderRadius: 8,
    },
    deleteButton: {
        padding: 8,
        backgroundColor: '#3f1219',
        borderRadius: 8,
    },
    fieldDetails: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    detailItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#0f172a',
        padding: 10,
        borderRadius: 10,
    },
    detailIcon: {
        fontSize: 20,
    },
    detailLabel: {
        fontSize: 11,
        color: '#64748b',
    },
    detailValue: {
        fontSize: 13,
        color: '#fff',
        fontWeight: '500',
    },
    detailValueUnknown: {
        color: '#F59E0B',
    },
    soilWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#422006',
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
    soilWarningText: {
        flex: 1,
        fontSize: 13,
        color: '#FCD34D',
    },
    fieldActions: {
        flexDirection: 'row',
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#334155',
    },
    fieldAction: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#0f172a',
        paddingVertical: 10,
        borderRadius: 10,
    },
    fieldActionText: {
        fontSize: 13,
        color: '#94a3b8',
    },
});