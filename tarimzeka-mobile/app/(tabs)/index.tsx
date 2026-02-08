import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import { useTheme } from '../../context/ThemeContext';

interface WeatherData {
    temperature: number;
    condition: string;
    humidity: number;
    description: string;
}

interface Field {
    id: string;
    name: string;
    cropType: string;
    soilType: string;
    location: string;
    area?: number;
    irrigationTime?: string;
    waterAmount?: number; // total liters
    waterPerM2?: number;
    waterLevel?: string;
    note?: string;
    hasSchedule?: boolean;
}

interface ScheduleItem {
    id: string;
    date: string;
    recommendedTime?: string;
    waterAmount: number; // L/m²
    weatherCondition?: string;
    note?: string;
    status?: string;
}

interface LocationData {
    city: string;
    district: string;
    coords: {
        latitude: number;
        longitude: number;
    };
}

export default function HomeScreen() {
    const { user } = useAuth() as any;
    const { colors } = useTheme();
    const router = useRouter();
    const [fields, setFields] = useState<Field[]>([]);
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [location, setLocation] = useState<LocationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentDate, setCurrentDate] = useState('');

    useEffect(() => {
        // Tarih ayarla
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        setCurrentDate(now.toLocaleDateString('tr-TR', options));

        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Konum al
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});

                // Konum adını al
                const [address] = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                });

                setLocation({
                    city: address?.city || address?.region || 'Bilinmiyor',
                    district: address?.district || address?.subregion || '',
                    coords: loc.coords
                });

                await fetchWeather(loc.coords.latitude, loc.coords.longitude);
            }
            await fetchFields();
        } catch (error) {

        } finally {
            setLoading(false);
        }
    };

    const fetchWeather = async (lat: number, lon: number) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(
                `${API_URL}/weather/current?lat=${lat}&lon=${lon}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (response.ok) {
                const data = await response.json();
                setWeather(data);
            }
        } catch (error) {

            // Mock data for testing
            setWeather({
                temperature: 24,
                condition: 'Güneşli',
                humidity: 45,
                description: 'Açık ve güneşli'
            });
        }
    };

    const fetchFields = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_URL}/fields`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const fieldsList = Array.isArray(data) ? data : [];

                const todayKey = formatDate(new Date());

                const fieldsWithRecommendations = await Promise.all(
                    fieldsList.map(async (field: Field) => {
                        try {
                            const schedulesResponse = await fetch(
                                `${API_URL}/fields/${field.id}`,
                                { headers: { 'Authorization': `Bearer ${token}` } }
                            );

                            if (schedulesResponse.ok) {
                                const fieldData = await schedulesResponse.json();
                                const schedules: ScheduleItem[] = fieldData.schedules || [];

                                const todaySchedule = schedules.find(s =>
                                    formatDate(new Date(s.date)) === todayKey && s.status === 'pending'
                                );

                                if (todaySchedule) {
                                    const areaM2 = (field.area ?? 1) * 1000;
                                    const totalLiters = Math.round((todaySchedule.waterAmount || 0) * areaM2);
                                    const perM2 = areaM2 > 0 ? totalLiters / areaM2 : totalLiters;

                                    return {
                                        ...field,
                                        irrigationTime: todaySchedule.recommendedTime || '06:00-08:00',
                                        waterAmount: totalLiters,
                                        waterPerM2: Number(perM2.toFixed(1)),
                                        waterLevel: getWaterLevelLabel(perM2),
                                        note: todaySchedule.note || todaySchedule.weatherCondition || 'Bugün sulama önerisi mevcut.',
                                        hasSchedule: true
                                    } as Field;
                                }
                            }
                        } catch (error) {

                        }

                        return {
                            ...field,
                            irrigationTime: '-',
                            waterAmount: 0,
                            waterPerM2: 0,
                            waterLevel: 'Yok',
                            note: 'Bugün için sulama önerisi yok.',
                            hasSchedule: false
                        } as Field;
                    })
                );

                setFields(fieldsWithRecommendations);
            }
        } catch (error) {

        }
    };

    const formatDate = (date: Date): string => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const getWaterLevelLabel = (perM2: number) => {
        if (perM2 <= 2) return 'Çok Az';
        if (perM2 <= 4) return 'Az';
        if (perM2 <= 6) return 'Orta';
        if (perM2 <= 8) return 'Yüksek';
        return 'Çok Yüksek';
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color="#16A34A" />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Veriler yükleniyor...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Konum ve Tarih Başlığı */}
            <View style={styles.header}>
                <View style={styles.locationContainer}>
                    <Ionicons name="location" size={20} color={colors.primary} />
                    <Text style={[styles.locationText, { color: colors.primary }]}>
                        {location?.district ? `${location.district}, ` : ''}{location?.city || 'Konum alınıyor...'}
                    </Text>
                </View>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>{currentDate}</Text>
                <Text style={[styles.greeting, { color: colors.text }]}>Merhaba, {user?.name || 'Çiftçi'}</Text>
            </View>

            {/* Hava Durumu Kartı */}
            <View style={[styles.weatherCard, { backgroundColor: colors.surface }]}>
                <View style={styles.weatherMain}>
                    <Ionicons
                        name={weather?.condition === 'Güneşli' ? 'sunny' : 'partly-sunny'}
                        size={48}
                        color="#F59E0B"
                    />
                    <View style={styles.weatherInfo}>
                        <Text style={[styles.temperature, { color: colors.text }]}>{weather?.temperature || '--'}°C</Text>
                        <Text style={[styles.weatherCondition, { color: colors.textSecondary }]}>{weather?.condition || 'Yükleniyor...'}</Text>
                    </View>
                </View>
                <View style={styles.weatherDetails}>
                    <View style={styles.weatherDetail}>
                        <Ionicons name="water-outline" size={16} color="#3B82F6" />
                        <Text style={[styles.weatherDetailText, { color: colors.textSecondary }]}>Nem: %{weather?.humidity || '--'}</Text>
                    </View>
                    <View style={styles.weatherDetail}>
                        <Ionicons name="leaf-outline" size={16} color="#16A34A" />
                        <Text style={[styles.weatherDetailText, { color: colors.textSecondary }]}>{weather?.description || ''}</Text>
                    </View>
                </View>
            </View>

            {/* Bugünkü Sulama Önerileri */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>💧 Bugünkü Sulama Önerileri</Text>

                {fields.length === 0 ? (
                    <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
                        <Ionicons name="leaf-outline" size={48} color="#9CA3AF" />
                        <Text style={[styles.emptyStateText, { color: colors.text }]}>Henüz tarla eklemediniz</Text>
                        <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                            Sulama önerilerini görmek için tarla ekleyin
                        </Text>
                    </View>
                ) : (
                    fields.map((field) => (
                        <View key={field.id} style={[styles.fieldCard, { backgroundColor: colors.surface }]}>
                            <View style={styles.fieldHeader}>
                                <View style={styles.fieldTitleRow}>
                                    <Ionicons name="leaf" size={24} color={colors.primary} />
                                    <Text style={[styles.fieldName, { color: colors.text }]}>{field.name}</Text>
                                </View>
                                <Text style={[styles.fieldCrop, { color: colors.primary, backgroundColor: colors.primaryDark }]}>{field.cropType}</Text>
                            </View>

                            <View style={styles.fieldRecommendations}>
                                <View style={[styles.recommendationItem, { backgroundColor: colors.inputBackground }]}>
                                    <Ionicons name="time-outline" size={20} color="#3B82F6" />
                                    <View>
                                        <Text style={[styles.recommendationLabel, { color: colors.textSecondary }]}>Önerilen Saat</Text>
                                        <Text style={[styles.recommendationValue, { color: colors.text }]}>{field.irrigationTime}</Text>
                                    </View>
                                </View>

                                <View style={[styles.recommendationItem, { backgroundColor: colors.inputBackground }]}>
                                    <Ionicons name="water" size={20} color="#06B6D4" />
                                    <View>
                                        <Text style={[styles.recommendationLabel, { color: colors.textSecondary }]}>Su Miktarı</Text>
                                        {field.hasSchedule ? (
                                            <View>
                                                <Text style={[styles.recommendationValue, { color: colors.text }]}>
                                                    {field.waterLevel} • {field.waterAmount} L
                                                </Text>
                                                <Text style={[styles.recommendationSubValue, { color: colors.textSecondary }]}>
                                                    ({field.waterPerM2} L/m²)
                                                </Text>
                                            </View>
                                        ) : (
                                            <Text style={[styles.recommendationValue, { color: colors.text }]}>Sulama yok</Text>
                                        )}
                                    </View>
                                </View>
                            </View>

                            <View style={[styles.noteContainer, { backgroundColor: colors.surfaceLight }]}
                            >
                                <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
                                <Text style={[styles.noteText, { color: colors.textSecondary }]}>{field.note}</Text>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* Hızlı İşlemler */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>⚡ Hızlı İşlemler</Text>
                <View style={styles.quickActions}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}
                        onPress={() => router.push('/soil-analysis' as any)}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: '#8B5CF620' }]}>
                            <Ionicons name="scan" size={24} color="#8B5CF6" />
                        </View>
                        <Text style={[styles.actionText, { color: colors.text }]}>Toprak Analizi</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}
                        onPress={() => router.push('/add-field' as any)}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: '#D1FAE5' }]}>
                            <Ionicons name="add-circle" size={24} color="#16A34A" />
                        </View>
                        <Text style={[styles.actionText, { color: colors.text }]}>Tarla Ekle</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.surface }]}
                        onPress={() => router.push('/(tabs)/calendar' as any)}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
                            <Ionicons name="calendar" size={24} color="#3B82F6" />
                        </View>
                        <Text style={[styles.actionText, { color: colors.text }]}>Takvim</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Alt boşluk */}
            <View style={{ height: 100 }} />
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
    loadingText: {
        color: '#94a3b8',
        marginTop: 12,
    },
    header: {
        padding: 20,
        paddingTop: 60,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    locationText: {
        fontSize: 14,
        color: '#16A34A',
        fontWeight: '500',
    },
    dateText: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 8,
    },
    weatherCard: {
        backgroundColor: '#1e293b',
        marginHorizontal: 20,
        padding: 20,
        borderRadius: 16,
    },
    weatherMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    weatherInfo: {
        flex: 1,
    },
    temperature: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#fff',
    },
    weatherCondition: {
        fontSize: 16,
        color: '#94a3b8',
    },
    weatherDetails: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 20,
    },
    weatherDetail: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    weatherDetailText: {
        fontSize: 14,
        color: '#94a3b8',
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#1e293b',
        borderRadius: 16,
    },
    emptyStateText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
    },
    emptyStateSubtext: {
        color: '#94a3b8',
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
    },
    fieldCard: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    fieldHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    fieldTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    fieldName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    fieldCrop: {
        fontSize: 14,
        color: '#16A34A',
        backgroundColor: '#064E3B',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    fieldRecommendations: {
        flexDirection: 'row',
        gap: 16,
    },
    recommendationItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#0f172a',
        padding: 8,
        borderRadius: 12,
    },
    recommendationLabel: {
        fontSize: 10,
        color: '#94a3b8',
    },
    recommendationValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    recommendationSubValue: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 1,
    },
    noteContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        backgroundColor: '#422006',
        padding: 10,
        borderRadius: 8,
    },
    noteText: {
        flex: 1,
        fontSize: 13,
        color: '#FCD34D',
    },
    quickActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flex: 1,
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    actionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },
});
