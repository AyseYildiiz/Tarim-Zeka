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
import { useTheme } from '../../context/ThemeContext';

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
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors, isDark);
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

    const normalizeCropName = (value: string) => {
        return (value || '')
            .trim()
            .toLowerCase()
            .replace(/\u0307/g, '')
            .replace(/ç/g, 'c')
            .replace(/ğ/g, 'g')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ş/g, 's')
            .replace(/ü/g, 'u');
    };

    const getCropIcon = (cropType: string) => {
        const crop = normalizeCropName(cropType || '');
        const cropIcons: { [key: string]: string } = {
            bugday: '🌾',
            arpa: '🌾',
            misir: '🌽',
            cavdar: '🌾',
            mercimek: '🟠',
            nohut: '🟤',
            domates: '🍅',
            biber: '🌶️',
            patlican: '🍆',
            salatalik: '🥒',
            kabak: '🎃',
            patates: '🥔',
            sogan: '🧅',
            sarimsak: '🧄',
            havuc: '🥕',
            lahana: '🥬',
            marul: '🥬',
            ispanak: '🥬',
            elma: '🍎',
            armut: '🍐',
            cilek: '🍓',
            kiraz: '🍒',
            uzum: '🍇',
            seftali: '🍑',
            kayisi: '🟠',
            erik: '🟣',
            karpuz: '🍉',
            kavun: '🍈',
            aycicegi: '🌻',
            kanola: '🌾',
            susam: '🟤',
            pamuk: '☁️',
            'iplik bitkileri': '🧵',
            zeytin: '🫒',
            nar: '🔴',
            incir: '🟤',
            cay: '🍃',
            kahve: '☕',
            cicek: '🌹',
            'ot (saman)': '🌱',
        };

        return cropIcons[crop] || '🌱';
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>🌾 Tarlalarım</Text>
                <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={() => router.push('/add-field' as any)}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={[styles.statsContainer, { backgroundColor: colors.surface }]}
            >
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}>{fields.length}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam Tarla</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}
                    >
                        {fields.reduce((sum, f) => sum + (f.area || 0), 0)}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam Dönüm</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text }]}
                    >
                        {new Set(fields.map(f => f.cropType)).size}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ürün Çeşidi</Text>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {fields.length === 0 ? (
                    <View style={[styles.emptyState, { backgroundColor: colors.surface }]}
                    >
                        <Ionicons name="leaf-outline" size={64} color={colors.textTertiary} />
                        <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
                            Henüz tarla eklemediniz
                        </Text>
                        <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                            Sulama önerilerini görmek için tarla ekleyin
                        </Text>
                        <TouchableOpacity
                            style={[styles.emptyStateButton, { backgroundColor: colors.primary }]}
                            onPress={() => router.push('/add-field' as any)}
                        >
                            <Ionicons name="add-circle" size={20} color="#fff" />
                            <Text style={styles.emptyStateButtonText}>Tarla Ekle</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    fields.map((field) => (
                        <View key={field.id} style={[styles.fieldCard, { backgroundColor: colors.surface }]}
                        >
                            <View style={styles.fieldHeader}>
                                <View style={styles.fieldTitleRow}>
                                    <Text style={styles.cropIcon}>{getCropIcon(field.cropType)}</Text>
                                    <View style={styles.fieldTitleContent}>
                                        <Text style={[styles.fieldName, { color: colors.text }]}>{field.name}</Text>
                                        <View style={styles.locationRow}>
                                            <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                                            <Text style={[styles.fieldLocation, { color: colors.textSecondary }]}>
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
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Toprak</Text>
                                        <Text
                                            style={[
                                                styles.detailValue,
                                                field.soilType === 'Bilmiyorum' && styles.detailValueUnknown,
                                                { color: colors.text }
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {field.soilType}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.detailItem}>
                                    <Text style={styles.detailIcon}>{getCropIcon(field.cropType)}</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Ürün</Text>
                                        <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>{field.cropType}</Text>
                                    </View>
                                </View>

                                {field.area && (
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailIcon}>📐</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Alan</Text>
                                            <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>{field.area} dönüm</Text>
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Toprak bilinmiyor uyarısı */}
                            {field.soilType === 'Bilmiyorum' && (
                                <TouchableOpacity
                                    style={[styles.soilWarning, { backgroundColor: colors.surfaceLight }]}
                                    onPress={() => router.push('/soil-analysis' as any)}
                                >
                                    <Ionicons name="information-circle" size={18} color="#F59E0B" />
                                    <Text style={[styles.soilWarningText, { color: colors.textSecondary }]}>
                                        Toprak türünü belirlemek için analiz yapın
                                    </Text>
                                    <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
                                </TouchableOpacity>
                            )}

                            {/* Quick Actions */}
                            <View style={styles.fieldActions}>
                                <TouchableOpacity
                                    style={[styles.fieldAction, { backgroundColor: colors.inputBackground }]}
                                    onPress={() => router.push(`/irrigation-schedule?fieldId=${field.id}` as any)}
                                >
                                    <Ionicons name="water" size={18} color="#3B82F6" />
                                    <Text style={[styles.fieldActionText, { color: colors.text }]}>
                                        Takvim
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.fieldAction, { backgroundColor: colors.inputBackground }]}
                                    onPress={() => router.push('/(tabs)/calendar' as any)}
                                >
                                    <Ionicons name="calendar" size={18} color="#16A34A" />
                                    <Text style={[styles.fieldActionText, { color: colors.text }]}>İstatistik</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.fieldAction, { backgroundColor: colors.inputBackground }]}
                                    onPress={() => router.push('/soil-analysis' as any)}
                                >
                                    <Ionicons name="analytics" size={18} color="#F59E0B" />
                                    <Text style={[styles.fieldActionText, { color: colors.text }]}>Analiz</Text>
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

const createStyles = (colors: {
    background: string;
    surface: string;
    surfaceLight: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    primary: string;
    border: string;
    borderLight: string;
    inputBackground: string;
    warning: string;
}, isDark: boolean) => {
    const editButtonBg = isDark ? '#1e3a5f' : '#dbeafe';
    const deleteButtonBg = isDark ? '#3f1219' : '#fee2e2';
    const warningBg = isDark ? '#422006' : '#fffbeb';
    const warningText = isDark ? '#FCD34D' : '#92400E';

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background,
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
            color: colors.text,
        },
        addButton: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
        },
        statsContainer: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            marginHorizontal: 20,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
        },
        statItem: {
            flex: 1,
            alignItems: 'center',
        },
        statValue: {
            fontSize: 24,
            fontWeight: 'bold',
            color: colors.text,
        },
        statLabel: {
            fontSize: 12,
            color: colors.textSecondary,
            marginTop: 4,
        },
        statDivider: {
            width: 1,
            backgroundColor: colors.border,
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
            color: colors.text,
            marginTop: 16,
        },
        emptyStateText: {
            fontSize: 14,
            color: colors.textSecondary,
            marginTop: 8,
            textAlign: 'center',
        },
        emptyStateButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.primary,
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
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
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
            color: colors.text,
        },
        locationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 2,
        },
        fieldLocation: {
            fontSize: 13,
            color: colors.textSecondary,
        },
        headerActions: {
            flexDirection: 'row',
            gap: 8,
        },
        editButton: {
            padding: 8,
            backgroundColor: editButtonBg,
            borderRadius: 8,
        },
        deleteButton: {
            padding: 8,
            backgroundColor: deleteButtonBg,
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
            backgroundColor: colors.inputBackground,
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
        detailIcon: {
            fontSize: 20,
        },
        detailLabel: {
            fontSize: 11,
            color: colors.textSecondary,
        },
        detailValue: {
            fontSize: 13,
            color: colors.text,
            fontWeight: '500',
            overflow: 'hidden',
        },
        detailValueUnknown: {
            color: colors.warning,
        },
        soilWarning: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: warningBg,
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
        },
        soilWarningText: {
            flex: 1,
            fontSize: 13,
            color: warningText,
        },
        fieldActions: {
            flexDirection: 'row',
            gap: 8,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        fieldAction: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: colors.inputBackground,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
        fieldActionText: {
            fontSize: 13,
            color: colors.textSecondary,
        },
    });
};