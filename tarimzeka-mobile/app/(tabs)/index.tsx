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
    irrigationTime?: string;
    waterAmount?: number;
    note?: string;
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
            console.error('Load data error:', error);
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
            console.error('Weather fetch error:', error);
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
                // Her tarla için sulama önerisi ekle
                const fieldsWithRecommendations = (Array.isArray(data) ? data : []).map((field: Field) => ({
                    ...field,
                    irrigationTime: calculateIrrigationTime(field),
                    waterAmount: calculateWaterAmount(field),
                    note: generateNote(field)
                }));
                setFields(fieldsWithRecommendations);
            }
        } catch (error) {
            console.error('Fields fetch error:', error);
        }
    };

    const calculateIrrigationTime = (field: Field): string => {
        // Basit öneri mantığı - gerçek uygulamada AI kullanılabilir
        const cropTimes: { [key: string]: string } = {
            'Buğday': '06:00',
            'Mısır': '05:30',
            'Domates': '07:00',
            'default': '06:00'
        };
        return cropTimes[field.cropType] || cropTimes['default'];
    };

    const calculateWaterAmount = (field: Field): number => {
        // Basit hesaplama - gerçek uygulamada toprak, hava durumu vb. kullanılır
        const baseAmount = 500; // Litre
        const soilFactor: { [key: string]: number } = {
            'Kumlu': 1.3,
            'Killi': 0.8,
            'Tınlı': 1.0,
            'default': 1.0
        };
        return Math.round(baseAmount * (soilFactor[field.soilType] || soilFactor['default']));
    };

    const generateNote = (field: Field): string => {
        const notes = [
            'Toprak nemi optimal seviyede',
            'Yarın yağış bekleniyor, sulamayı azaltın',
            'Sıcak hava nedeniyle ekstra sulama önerilir',
            'Normal sulama programına devam edin'
        ];
        return notes[Math.floor(Math.random() * notes.length)];
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16A34A" />
                <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Konum ve Tarih Başlığı */}
            <View style={styles.header}>
                <View style={styles.locationContainer}>
                    <Ionicons name="location" size={20} color="#16A34A" />
                    <Text style={styles.locationText}>
                        {location?.district ? `${location.district}, ` : ''}{location?.city || 'Konum alınıyor...'}
                    </Text>
                </View>
                <Text style={styles.dateText}>{currentDate}</Text>
                <Text style={styles.greeting}>Merhaba, {user?.name || 'Çiftçi'}</Text>
            </View>

            {/* Hava Durumu Kartı */}
            <View style={styles.weatherCard}>
                <View style={styles.weatherMain}>
                    <Ionicons
                        name={weather?.condition === 'Güneşli' ? 'sunny' : 'partly-sunny'}
                        size={48}
                        color="#F59E0B"
                    />
                    <View style={styles.weatherInfo}>
                        <Text style={styles.temperature}>{weather?.temperature || '--'}°C</Text>
                        <Text style={styles.weatherCondition}>{weather?.condition || 'Yükleniyor...'}</Text>
                    </View>
                </View>
                <View style={styles.weatherDetails}>
                    <View style={styles.weatherDetail}>
                        <Ionicons name="water-outline" size={16} color="#3B82F6" />
                        <Text style={styles.weatherDetailText}>Nem: %{weather?.humidity || '--'}</Text>
                    </View>
                    <View style={styles.weatherDetail}>
                        <Ionicons name="leaf-outline" size={16} color="#16A34A" />
                        <Text style={styles.weatherDetailText}>{weather?.description || ''}</Text>
                    </View>
                </View>
            </View>

            {/* Bugünkü Sulama Önerileri */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>💧 Bugünkü Sulama Önerileri</Text>

                {fields.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="leaf-outline" size={48} color="#9CA3AF" />
                        <Text style={styles.emptyStateText}>Henüz tarla eklemediniz</Text>
                        <Text style={styles.emptyStateSubtext}>
                            Sulama önerilerini görmek için tarla ekleyin
                        </Text>
                    </View>
                ) : (
                    fields.map((field) => (
                        <View key={field.id} style={styles.fieldCard}>
                            <View style={styles.fieldHeader}>
                                <View style={styles.fieldTitleRow}>
                                    <Ionicons name="leaf" size={24} color="#16A34A" />
                                    <Text style={styles.fieldName}>{field.name}</Text>
                                </View>
                                <Text style={styles.fieldCrop}>{field.cropType}</Text>
                            </View>

                            <View style={styles.fieldRecommendations}>
                                <View style={styles.recommendationItem}>
                                    <Ionicons name="time-outline" size={20} color="#3B82F6" />
                                    <View>
                                        <Text style={styles.recommendationLabel}>Önerilen Saat</Text>
                                        <Text style={styles.recommendationValue}>{field.irrigationTime}</Text>
                                    </View>
                                </View>

                                <View style={styles.recommendationItem}>
                                    <Ionicons name="water" size={20} color="#06B6D4" />
                                    <View>
                                        <Text style={styles.recommendationLabel}>Su Miktarı</Text>
                                        <Text style={styles.recommendationValue}>{field.waterAmount} L</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.noteContainer}>
                                <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
                                <Text style={styles.noteText}>{field.note}</Text>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* Hızlı İşlemler */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚡ Hızlı İşlemler</Text>
                <View style={styles.quickActions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => router.push('/soil-analysis' as any)}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: '#8B5CF620' }]}>
                            <Ionicons name="scan" size={24} color="#8B5CF6" />
                        </View>
                        <Text style={styles.actionText}>Toprak Analizi</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => router.push('/add-field' as any)}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: '#D1FAE5' }]}>
                            <Ionicons name="add-circle" size={24} color="#16A34A" />
                        </View>
                        <Text style={styles.actionText}>Tarla Ekle</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => router.push('/(tabs)/calendar' as any)}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
                            <Ionicons name="calendar" size={24} color="#3B82F6" />
                        </View>
                        <Text style={styles.actionText}>Takvim</Text>
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
        gap: 10,
        backgroundColor: '#0f172a',
        padding: 12,
        borderRadius: 12,
    },
    recommendationLabel: {
        fontSize: 12,
        color: '#94a3b8',
    },
    recommendationValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
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