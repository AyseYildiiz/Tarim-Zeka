import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import LocationPicker from '../components/LocationPicker';

const SOIL_TYPES = [
    { value: 'Bilmiyorum', label: 'Bilmiyorum', icon: '❓' },
    { value: 'Killi', label: 'Killi', icon: '🟤' },
    { value: 'Kumlu', label: 'Kumlu', icon: '🟡' },
    { value: 'Tınlı', label: 'Tınlı', icon: '🟠' },
    { value: 'Balçık', label: 'Balçık', icon: '⚫' },
    { value: 'Çakıllı', label: 'Çakıllı', icon: '⚪' },
];

const CROP_TYPES = [
    { value: 'Buğday', icon: '🌾' },
    { value: 'Mısır', icon: '🌽' },
    { value: 'Domates', icon: '🍅' },
    { value: 'Biber', icon: '🌶️' },
    { value: 'Patates', icon: '🥔' },
    { value: 'Ayçiçeği', icon: '🌻' },
    { value: 'Pamuk', icon: '☁️' },
    { value: 'Üzüm', icon: '🍇' },
    { value: 'Zeytin', icon: '🫒' },
    { value: 'Elma', icon: '🍎' },
];

export default function EditFieldScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [selectedSoilType, setSelectedSoilType] = useState('');
    const [selectedCropType, setSelectedCropType] = useState('');
    const [area, setArea] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [showLocationPicker, setShowLocationPicker] = useState(false);

    // Tarla verilerini yükle
    useEffect(() => {
        loadFieldData();
    }, [id]);

    const loadFieldData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${API_URL}/fields/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const field = await response.json();
                setName(field.name || '');
                setLocation(field.location || '');
                setSelectedSoilType(field.soilType || 'Bilmiyorum');
                setSelectedCropType(field.cropType || '');
                setArea(field.area ? String(field.area) : '');

                if (field.latitude && field.longitude) {
                    setCoords({
                        latitude: field.latitude,
                        longitude: field.longitude
                    });
                }
            } else {
                Alert.alert('Hata', 'Tarla bilgisi alınamadı');
                router.back();
            }
        } catch (error) {
            console.error('Load field error:', error);
            Alert.alert('Hata', 'Bağlantı hatası');
            router.back();
        } finally {
            setFetching(false);
        }
    };

    // Mevcut konumu al
    const getCurrentLocation = async () => {
        setGettingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('İzin Gerekli', 'Konum izni verilmedi');
                return;
            }

            const loc = await Location.getCurrentPositionAsync({});
            const [address] = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude
            });

            setCoords({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude
            });

            const locationText = [
                address?.street,
                address?.district,
                address?.city,
                address?.region
            ].filter(Boolean).join(', ');

            setLocation(locationText || 'Konum alındı');

        } catch (error) {
            console.error('Location error:', error);
            Alert.alert('Hata', 'Konum alınamadı');
        } finally {
            setGettingLocation(false);
        }
    };

    // Haritadan konum seçildiğinde
    const handleLocationSelect = (selectedLocation: {
        address: string;
        latitude: number;
        longitude: number;
    }) => {
        setLocation(selectedLocation.address);
        setCoords({
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude
        });
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            Alert.alert('Uyarı', 'Tarla adı zorunludur');
            return;
        }
        if (!selectedCropType) {
            Alert.alert('Uyarı', 'Ürün türü seçiniz');
            return;
        }

        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');

            const response = await fetch(`${API_URL}/fields/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: name.trim(),
                    location: location.trim(),
                    soilType: selectedSoilType || 'Bilmiyorum',
                    cropType: selectedCropType,
                    area: area ? parseFloat(area) : null,
                    latitude: coords?.latitude || null,
                    longitude: coords?.longitude || null
                })
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert('Başarılı', 'Tarla başarıyla güncellendi', [
                    { text: 'Tamam', onPress: () => router.back() }
                ]);
            } else {
                Alert.alert('Hata', data.error || 'Tarla güncellenemedi');
            }
        } catch (error) {
            console.error('Update field error:', error);
            Alert.alert('Hata', 'Bağlantı hatası');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16A34A" />
                <Text style={styles.loadingText}>Tarla bilgileri yükleniyor...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>✏️ Tarla Düzenle</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {/* Tarla Adı */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Tarla Adı *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Örn: Kuzey Tarla"
                            placeholderTextColor="#64748b"
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    {/* Konum */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Konum</Text>
                        <Text style={styles.labelHint}>
                            Hava durumu ve sulama önerileri için konum gereklidir
                        </Text>

                        {/* Konum Seçim Butonları */}
                        <View style={styles.locationButtons}>
                            <TouchableOpacity
                                style={styles.locationOptionButton}
                                onPress={() => setShowLocationPicker(true)}
                            >
                                <Ionicons name="map" size={24} color="#3B82F6" />
                                <Text style={styles.locationOptionText}>Haritadan Seç</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.locationOptionButton}
                                onPress={getCurrentLocation}
                                disabled={gettingLocation}
                            >
                                {gettingLocation ? (
                                    <ActivityIndicator size="small" color="#16A34A" />
                                ) : (
                                    <Ionicons name="navigate" size={24} color="#16A34A" />
                                )}
                                <Text style={styles.locationOptionText}>Konumumu Al</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Seçilen Konum Gösterimi */}
                        {location ? (
                            <View style={styles.selectedLocationCard}>
                                <View style={styles.selectedLocationIcon}>
                                    <Ionicons name="location" size={24} color="#16A34A" />
                                </View>
                                <View style={styles.selectedLocationContent}>
                                    <Text style={styles.selectedLocationLabel}>Seçilen Konum</Text>
                                    <Text style={styles.selectedLocationText} numberOfLines={2}>
                                        {location}
                                    </Text>
                                    {coords && (
                                        <Text style={styles.selectedLocationCoords}>
                                            📍 {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={styles.clearLocationButton}
                                    onPress={() => {
                                        setLocation('');
                                        setCoords(null);
                                    }}
                                >
                                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.noLocationCard}>
                                <Ionicons name="location-outline" size={32} color="#64748b" />
                                <Text style={styles.noLocationText}>Henüz konum seçilmedi</Text>
                            </View>
                        )}
                    </View>

                    {/* Alan (Dönüm) */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Alan (Dönüm)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Örn: 5"
                            placeholderTextColor="#64748b"
                            value={area}
                            onChangeText={setArea}
                            keyboardType="numeric"
                        />
                    </View>

                    {/* Toprak Türü */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Toprak Türü</Text>
                        <Text style={styles.labelHint}>
                            Emin değilseniz "Bilmiyorum" seçeneğini seçin
                        </Text>
                        <View style={styles.optionsContainer}>
                            {SOIL_TYPES.map((soil) => (
                                <TouchableOpacity
                                    key={soil.value}
                                    style={[
                                        styles.optionButton,
                                        selectedSoilType === soil.value && styles.optionButtonSelected,
                                        soil.value === 'Bilmiyorum' && selectedSoilType !== soil.value && styles.optionButtonUnknown
                                    ]}
                                    onPress={() => setSelectedSoilType(soil.value)}
                                >
                                    <Text style={styles.optionIcon}>{soil.icon}</Text>
                                    <Text style={[
                                        styles.optionText,
                                        selectedSoilType === soil.value && styles.optionTextSelected
                                    ]}>
                                        {soil.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Ürün Türü */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Ürün Türü *</Text>
                        <View style={styles.optionsContainer}>
                            {CROP_TYPES.map((crop) => (
                                <TouchableOpacity
                                    key={crop.value}
                                    style={[
                                        styles.optionButton,
                                        selectedCropType === crop.value && styles.optionButtonSelected
                                    ]}
                                    onPress={() => setSelectedCropType(crop.value)}
                                >
                                    <Text style={styles.optionIcon}>{crop.icon}</Text>
                                    <Text style={[
                                        styles.optionText,
                                        selectedCropType === crop.value && styles.optionTextSelected
                                    ]}>
                                        {crop.value}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="save" size={24} color="#fff" />
                                <Text style={styles.submitButtonText}>Değişiklikleri Kaydet</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Harita Modal */}
            <LocationPicker
                visible={showLocationPicker}
                onClose={() => setShowLocationPicker(false)}
                onSelectLocation={handleLocationSelect}
                initialLocation={coords || undefined}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
    },
    loadingText: {
        color: '#94a3b8',
        marginTop: 16,
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        paddingTop: 10,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    form: {
        padding: 20,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    labelHint: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 12,
    },
    input: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#334155',
    },
    locationButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    locationOptionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
    },
    locationOptionText: {
        color: '#fff',
        fontWeight: '500',
        fontSize: 14,
    },
    selectedLocationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#14532d',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#16A34A',
    },
    selectedLocationIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#166534',
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedLocationContent: {
        flex: 1,
    },
    selectedLocationLabel: {
        fontSize: 12,
        color: '#86efac',
        marginBottom: 4,
    },
    selectedLocationText: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '500',
    },
    selectedLocationCoords: {
        fontSize: 11,
        color: '#86efac',
        marginTop: 4,
    },
    clearLocationButton: {
        padding: 4,
    },
    noLocationCard: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#1e293b',
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        borderStyle: 'dashed',
    },
    noLocationText: {
        color: '#64748b',
        fontSize: 14,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#1e293b',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#334155',
    },
    optionButtonSelected: {
        backgroundColor: '#16A34A',
        borderColor: '#16A34A',
    },
    optionButtonUnknown: {
        borderColor: '#F59E0B',
        borderStyle: 'dashed',
    },
    optionIcon: {
        fontSize: 16,
    },
    optionText: {
        color: '#94a3b8',
        fontWeight: '500',
    },
    optionTextSelected: {
        color: '#fff',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#3B82F6',
        padding: 18,
        borderRadius: 12,
        marginTop: 20,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});