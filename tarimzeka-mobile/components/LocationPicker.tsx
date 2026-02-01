import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Keyboard,
    Platform,
    Dimensions
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LocationPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelectLocation: (location: {
        address: string;
        latitude: number;
        longitude: number;
    }) => void;
    initialLocation?: {
        latitude: number;
        longitude: number;
    };
}

interface SearchResult {
    id: string;
    title: string;
    subtitle: string;
    fullAddress: string;
    latitude: number;
    longitude: number;
    type: 'city' | 'district' | 'neighborhood' | 'street' | 'poi' | 'building' | 'place';
    category?: string;
}

// Popüler Türkiye şehirleri
const POPULAR_CITIES: SearchResult[] = [
    { id: 'ist', title: 'İstanbul', subtitle: 'Marmara', fullAddress: 'İstanbul, Türkiye', latitude: 41.0082, longitude: 28.9784, type: 'city' },
    { id: 'ank', title: 'Ankara', subtitle: 'İç Anadolu', fullAddress: 'Ankara, Türkiye', latitude: 39.9334, longitude: 32.8597, type: 'city' },
    { id: 'izm', title: 'İzmir', subtitle: 'Ege', fullAddress: 'İzmir, Türkiye', latitude: 38.4237, longitude: 27.1428, type: 'city' },
    { id: 'brs', title: 'Bursa', subtitle: 'Marmara', fullAddress: 'Bursa, Türkiye', latitude: 40.1885, longitude: 29.0610, type: 'city' },
    { id: 'ant', title: 'Antalya', subtitle: 'Akdeniz', fullAddress: 'Antalya, Türkiye', latitude: 36.8969, longitude: 30.7133, type: 'city' },
    { id: 'kny', title: 'Konya', subtitle: 'İç Anadolu', fullAddress: 'Konya, Türkiye', latitude: 37.8746, longitude: 32.4932, type: 'city' },
    { id: 'adn', title: 'Adana', subtitle: 'Akdeniz', fullAddress: 'Adana, Türkiye', latitude: 37.0000, longitude: 35.3213, type: 'city' },
    { id: 'gaz', title: 'Gaziantep', subtitle: 'Güneydoğu Anadolu', fullAddress: 'Gaziantep, Türkiye', latitude: 37.0662, longitude: 37.3833, type: 'city' },
    { id: 'snl', title: 'Şanlıurfa', subtitle: 'Güneydoğu Anadolu', fullAddress: 'Şanlıurfa, Türkiye', latitude: 37.1591, longitude: 38.7969, type: 'city' },
    { id: 'diy', title: 'Diyarbakır', subtitle: 'Güneydoğu Anadolu', fullAddress: 'Diyarbakır, Türkiye', latitude: 37.9144, longitude: 40.2306, type: 'city' },
    { id: 'mer', title: 'Mersin', subtitle: 'Akdeniz', fullAddress: 'Mersin, Türkiye', latitude: 36.8121, longitude: 34.6415, type: 'city' },
    { id: 'kay', title: 'Kayseri', subtitle: 'İç Anadolu', fullAddress: 'Kayseri, Türkiye', latitude: 38.7312, longitude: 35.4787, type: 'city' },
];

export default function LocationPicker({
    visible,
    onClose,
    onSelectLocation,
    initialLocation
}: LocationPickerProps) {
    const mapRef = useRef<MapView>(null);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{
        latitude: number;
        longitude: number;
        address: string;
    } | null>(null);
    const [region, setRegion] = useState({
        latitude: initialLocation?.latitude || 39.9334,
        longitude: initialLocation?.longitude || 32.8597,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [showPopularCities, setShowPopularCities] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    useEffect(() => {
        if (visible && !initialLocation) {
            getCurrentLocation();
        } else if (visible && initialLocation) {
            setRegion(prev => ({
                ...prev,
                latitude: initialLocation.latitude,
                longitude: initialLocation.longitude,
            }));
            getAddressFromCoords(initialLocation.latitude, initialLocation.longitude);
        }
    }, [visible, initialLocation]);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    const searchLocation = async (query: string) => {
        if (query.length < 2) return;

        setSearching(true);
        setSearchError(null);

        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(
                `${API_URL}/location/search?query=${encodeURIComponent(query)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const results = await response.json();
                if (results.length > 0) {
                    setSearchResults(results);
                } else {
                    fallbackSearch(query);
                }
            } else {
                fallbackSearch(query);
            }
        } catch (error) {
            console.error('Search error:', error);
            fallbackSearch(query);
        } finally {
            setSearching(false);
        }
    };

    const fallbackSearch = (query: string) => {
        const lowerQuery = query.toLowerCase().trim();
        const results = POPULAR_CITIES.filter(city =>
            city.title.toLowerCase().includes(lowerQuery) ||
            city.subtitle.toLowerCase().includes(lowerQuery)
        );

        if (results.length > 0) {
            setSearchResults(results);
        } else {
            setSearchResults([]);
            setSearchError(`"${query}" için sonuç bulunamadı`);
        }
    };

    const debouncedSearch = useCallback((query: string) => {
        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }
        searchTimeout.current = setTimeout(() => {
            searchLocation(query);
        }, 500);
    }, []);

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        setShowPopularCities(false);
        setSearchError(null);

        if (text.length === 0) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        if (text.length >= 2) {
            setShowResults(true);
            fallbackSearch(text);
            debouncedSearch(text);
        }
    };

    const getAddressFromCoords = async (latitude: number, longitude: number) => {
        setLoadingAddress(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(
                `${API_URL}/location/reverse?lat=${latitude}&lon=${longitude}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setSelectedLocation({ latitude, longitude, address: data.address });
            } else {
                fallbackReverseGeocode(latitude, longitude);
            }
        } catch (error) {
            fallbackReverseGeocode(latitude, longitude);
        } finally {
            setLoadingAddress(false);
        }
    };

    const fallbackReverseGeocode = async (latitude: number, longitude: number) => {
        try {
            const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
            const addressParts = [
                address?.street,
                address?.district,
                address?.city,
                address?.region
            ].filter(Boolean);

            setSelectedLocation({
                latitude,
                longitude,
                address: addressParts.join(', ') || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            });
        } catch (error) {
            setSelectedLocation({
                latitude,
                longitude,
                address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            });
        }
    };

    const getCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const location = await Location.getCurrentPositionAsync({});
            const newRegion = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
            setRegion(newRegion);
            mapRef.current?.animateToRegion(newRegion, 500);
            await getAddressFromCoords(location.coords.latitude, location.coords.longitude);
        } catch (error) {
            console.error('Get location error:', error);
        }
    };

    const handleSelectSearchResult = (result: SearchResult) => {
        Keyboard.dismiss();
        setSearchQuery(result.title);
        setShowResults(false);
        setShowPopularCities(false);

        const zoomLevel = result.type === 'city' ? 0.1 :
            result.type === 'district' ? 0.05 : 0.01;

        const newRegion = {
            latitude: result.latitude,
            longitude: result.longitude,
            latitudeDelta: zoomLevel,
            longitudeDelta: zoomLevel,
        };

        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 500);
        setSelectedLocation({
            latitude: result.latitude,
            longitude: result.longitude,
            address: result.fullAddress
        });
    };

    const handleMapPress = async (event: any) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        await getAddressFromCoords(latitude, longitude);
    };

    const handleConfirm = () => {
        if (selectedLocation) {
            onSelectLocation(selectedLocation);
            onClose();
        }
    };

    const getIconForType = (type: string, category?: string) => {
        // Kategoriye göre özel ikonlar
        if (category) {
            const categoryIcons: { [key: string]: string } = {
                'Hastane': 'medical',
                'Klinik': 'medical',
                'Eczane': 'medical',
                'Okul': 'school',
                'Üniversite': 'school',
                'Kolej': 'school',
                'Anaokulu': 'school',
                'Kütüphane': 'library',
                'Banka': 'card',
                'ATM': 'card',
                'Postane': 'mail',
                'Polis': 'shield',
                'İtfaiye': 'flame',
                'Adliye': 'briefcase',
                'Belediye': 'business',
                'Cami': 'moon',
                'İbadet Yeri': 'moon',
                'Restoran': 'restaurant',
                'Kafe': 'cafe',
                'Fast Food': 'fast-food',
                'Benzin İstasyonu': 'car',
                'Otopark': 'car',
                'Otobüs Terminali': 'bus',
                'Taksi Durağı': 'car',
                'Tiyatro': 'film',
                'Sinema': 'film',
                'Süpermarket': 'cart',
                'Market': 'cart',
                'Fırın': 'nutrition',
                'Kasap': 'nutrition',
                'Manav': 'leaf',
                'AVM': 'storefront',
                'Mağaza': 'storefront',
                'Otel': 'bed',
                'Pansiyon': 'bed',
                'Müze': 'image',
                'Park': 'leaf',
                'Stadyum': 'football',
                'Spor Merkezi': 'fitness',
                'Havalimanı': 'airplane',
                'İstasyon': 'train',
                'Apartman': 'home',
                'Ev': 'home',
                'Konut': 'home',
                'Ofis': 'business',
                'Bina': 'business'
            };
            if (categoryIcons[category]) {
                return categoryIcons[category];
            }
        }

        // Tipe göre genel ikonlar
        switch (type) {
            case 'city': return 'business';
            case 'district': return 'map';
            case 'neighborhood': return 'people';
            case 'street': return 'navigate';
            case 'poi': return 'location';
            case 'building': return 'home';
            default: return 'pin';
        }
    };

    const getIconColorForType = (type: string) => {
        switch (type) {
            case 'city': return '#3B82F6';      // Mavi
            case 'district': return '#8B5CF6';   // Mor
            case 'neighborhood': return '#F59E0B'; // Turuncu
            case 'street': return '#10B981';     // Yeşil
            case 'poi': return '#EF4444';        // Kırmızı
            case 'building': return '#06B6D4';   // Cyan
            default: return '#64748b';           // Gri
        }
    };

    const getTypeLabel = (type: string, category?: string) => {
        if (category) return category;

        switch (type) {
            case 'city': return 'Şehir';
            case 'district': return 'İlçe';
            case 'neighborhood': return 'Mahalle';
            case 'street': return 'Sokak/Cadde';
            case 'poi': return 'Konum';
            case 'building': return 'Bina';
            default: return 'Yer';
        }
    };

    const handleSearchFocus = () => {
        if (searchQuery.length === 0) {
            setShowPopularCities(true);
            setShowResults(false);
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
        setShowPopularCities(false);
        setSearchError(null);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>📍 Konum Seç</Text>
                    <View style={{ width: 28 }} />
                </View>

                {/* Arama Kutusu */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={20} color="#64748b" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Şehir, ilçe veya mahalle ara..."
                            placeholderTextColor="#64748b"
                            value={searchQuery}
                            onChangeText={handleSearchChange}
                            onFocus={handleSearchFocus}
                            returnKeyType="search"
                            autoCorrect={false}
                        />
                        {searching && <ActivityIndicator size="small" color="#16A34A" />}
                        {searchQuery.length > 0 && !searching && (
                            <TouchableOpacity onPress={clearSearch}>
                                <Ionicons name="close-circle" size={20} color="#64748b" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Popüler Şehirler */}
                {showPopularCities && (
                    <View style={styles.dropdownOverlay}>
                        <View style={styles.popularCitiesBox}>
                            <Text style={styles.popularTitle}>🏙️ Popüler Şehirler</Text>
                            <View style={styles.popularGrid}>
                                {POPULAR_CITIES.slice(0, 8).map((city) => (
                                    <TouchableOpacity
                                        key={city.id}
                                        style={styles.popularChip}
                                        onPress={() => handleSelectSearchResult(city)}
                                    >
                                        <Text style={styles.popularChipText}>{city.title}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {/* Arama Sonuçları */}
                {showResults && searchResults.length > 0 && (
                    <View style={styles.dropdownOverlay}>
                        <View style={styles.resultsBox}>
                            <View style={styles.resultsHeader}>
                                <Text style={styles.resultsHeaderText}>
                                    {searching ? 'Aranıyor...' : `${searchResults.length} sonuç bulundu`}
                                </Text>
                                <TouchableOpacity onPress={clearSearch}>
                                    <Ionicons name="close" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                style={styles.resultsScroll}
                                showsVerticalScrollIndicator={true}
                                bounces={true}
                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="handled"
                            >
                                {searchResults.map((item, index) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[
                                            styles.resultItem,
                                            index === searchResults.length - 1 && styles.lastResultItem
                                        ]}
                                        onPress={() => handleSelectSearchResult(item)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[
                                            styles.resultIcon,
                                            { backgroundColor: `${getIconColorForType(item.type)}20` }
                                        ]}>
                                            <Ionicons
                                                name={getIconForType(item.type, item.category) as any}
                                                size={20}
                                                color={getIconColorForType(item.type)}
                                            />
                                        </View>
                                        <View style={styles.resultText}>
                                            <View style={styles.resultTitleRow}>
                                                <Text style={styles.resultTitle} numberOfLines={1}>
                                                    {item.title}
                                                </Text>
                                                <View style={[
                                                    styles.typeTag,
                                                    { backgroundColor: `${getIconColorForType(item.type)}20` }
                                                ]}>
                                                    <Text style={[
                                                        styles.typeTagText,
                                                        { color: getIconColorForType(item.type) }
                                                    ]}>
                                                        {getTypeLabel(item.type, item.category)}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.resultSubtitle} numberOfLines={2}>
                                                {item.subtitle}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#64748b" />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                )}

                {/* Harita */}
                <View style={styles.mapContainer}>
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        region={region}
                        onRegionChangeComplete={setRegion}
                        onPress={handleMapPress}
                        showsUserLocation
                        showsMyLocationButton={false}
                    >
                        {selectedLocation && (
                            <Marker
                                coordinate={{
                                    latitude: selectedLocation.latitude,
                                    longitude: selectedLocation.longitude,
                                }}
                                draggable
                                onDragEnd={(e) => {
                                    const { latitude, longitude } = e.nativeEvent.coordinate;
                                    getAddressFromCoords(latitude, longitude);
                                }}
                            />
                        )}
                    </MapView>

                    <TouchableOpacity style={styles.myLocationButton} onPress={getCurrentLocation}>
                        <Ionicons name="navigate" size={24} color="#16A34A" />
                    </TouchableOpacity>

                    <View style={styles.zoomButtons}>
                        <TouchableOpacity
                            style={styles.zoomButton}
                            onPress={() => {
                                const newRegion = {
                                    ...region,
                                    latitudeDelta: region.latitudeDelta / 2,
                                    longitudeDelta: region.longitudeDelta / 2,
                                };
                                setRegion(newRegion);
                                mapRef.current?.animateToRegion(newRegion, 300);
                            }}
                        >
                            <Ionicons name="add" size={24} color="#1e293b" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.zoomButton}
                            onPress={() => {
                                const newRegion = {
                                    ...region,
                                    latitudeDelta: Math.min(region.latitudeDelta * 2, 20),
                                    longitudeDelta: Math.min(region.longitudeDelta * 2, 20),
                                };
                                setRegion(newRegion);
                                mapRef.current?.animateToRegion(newRegion, 300);
                            }}
                        >
                            <Ionicons name="remove" size={24} color="#1e293b" />
                        </TouchableOpacity>
                    </View>

                    {!showResults && !showPopularCities && (
                        <View style={styles.mapHint}>
                            <Ionicons name="hand-left-outline" size={16} color="#64748b" />
                            <Text style={styles.mapHintText}>Haritaya dokunarak konum seçin</Text>
                        </View>
                    )}
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    {loadingAddress ? (
                        <View style={styles.addressLoading}>
                            <ActivityIndicator size="small" color="#16A34A" />
                            <Text style={styles.addressLoadingText}>Adres alınıyor...</Text>
                        </View>
                    ) : selectedLocation ? (
                        <View style={styles.selectedAddress}>
                            <View style={styles.addressIcon}>
                                <Ionicons name="location" size={24} color="#16A34A" />
                            </View>
                            <View style={styles.addressContent}>
                                <Text style={styles.addressLabel}>Seçilen Konum</Text>
                                <Text style={styles.addressText} numberOfLines={2}>
                                    {selectedLocation.address}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.noSelection}>
                            <Ionicons name="location-outline" size={24} color="#64748b" />
                            <Text style={styles.noSelectionText}>Haritadan konum seçin</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.confirmButton, !selectedLocation && styles.confirmButtonDisabled]}
                        onPress={handleConfirm}
                        disabled={!selectedLocation}
                    >
                        <Ionicons name="checkmark" size={24} color="#fff" />
                        <Text style={styles.confirmButtonText}>Konumu Onayla</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 40,
        backgroundColor: '#1e293b',
    },
    closeButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    searchContainer: {
        backgroundColor: '#1e293b',
        paddingHorizontal: 16,
        paddingBottom: 16,
        zIndex: 10,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        borderRadius: 12,
        paddingHorizontal: 14,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 16,
        color: '#fff',
    },

    // Dropdown overlay
    dropdownOverlay: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 155 : 145,
        left: 16,
        right: 16,
        zIndex: 9999,
        elevation: 999,
    },

    // Popüler şehirler
    popularCitiesBox: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    popularTitle: {
        color: '#94a3b8',
        fontSize: 13,
        marginBottom: 12,
        fontWeight: '600',
    },
    popularGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    popularChip: {
        backgroundColor: '#334155',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
    },
    popularChipText: {
        color: '#fff',
        fontSize: 14,
    },

    // Arama sonuçları
    resultsBox: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        maxHeight: SCREEN_HEIGHT * 0.45,
    },
    resultsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        backgroundColor: '#0f172a',
    },
    resultsHeaderText: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '500',
    },
    resultsScroll: {
        flexGrow: 0,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    lastResultItem: {
        borderBottomWidth: 0,
    },
    resultIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultText: {
        flex: 1,
    },
    resultTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    resultTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    typeTag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    typeTagText: {
        fontSize: 10,
        fontWeight: '600',
    },
    resultSubtitle: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 2,
        lineHeight: 16,
    },

    // Harita
    mapContainer: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
    myLocationButton: {
        position: 'absolute',
        right: 16,
        top: 16,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    zoomButtons: {
        position: 'absolute',
        right: 16,
        top: 80,
        gap: 8,
    },
    zoomButton: {
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    mapHint: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        padding: 12,
        borderRadius: 10,
    },
    mapHintText: {
        color: '#94a3b8',
        fontSize: 13,
    },

    // Footer
    footer: {
        padding: 16,
        backgroundColor: '#1e293b',
        gap: 16,
    },
    addressLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 10,
    },
    addressLoadingText: {
        color: '#94a3b8',
    },
    selectedAddress: {
        flexDirection: 'row',
        gap: 12,
    },
    addressIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#14532d',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addressContent: {
        flex: 1,
    },
    addressLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    addressText: {
        fontSize: 15,
        color: '#fff',
        fontWeight: '500',
    },
    noSelection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 10,
    },
    noSelectionText: {
        color: '#64748b',
        fontSize: 14,
    },
    confirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#16A34A',
        padding: 16,
        borderRadius: 12,
    },
    confirmButtonDisabled: {
        backgroundColor: '#334155',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});