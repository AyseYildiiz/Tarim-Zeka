import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { useTheme } from '../context/ThemeContext';

interface SoilAnalysis {
    id: string;
    imageUrl: string;
    analysis: {
        soilType: string;
        soilColor: string;
        moistureLevel: string;
        moisturePercentage: number;
        organicMatter: {
            level: string;
            percentage: number;
            description: string;
        };
        structure: {
            type: string;
            quality: string;
            description: string;
        };
        texture: {
            class: string;
            sandPercentage: number;
            clayPercentage: number;
            siltPercentage: number;
        };
        drainage: {
            status: string;
            description: string;
        };
        ph: {
            estimated: number;
            status: string;
            description: string;
        };
        nutrients: {
            nitrogen: string;
            phosphorus: string;
            potassium: string;
            description: string;
        };
        irrigation: {
            currentNeed: string;
            recommendedMethod: string;
            frequency: string;
            amount: string;
            bestTime: string;
            warnings: string[];
        };
        fertilization: {
            needed: boolean;
            recommendations: Array<{
                type: string;
                product: string;
                amount: string;
                timing: string;
                method: string;
            }>;
            organicOptions: string[];
        };
        suitableCrops: {
            excellent: Array<{ name: string; reason: string; tips: string }>;
            good: Array<{ name: string; reason: string; precautions: string }>;
            notRecommended: Array<{ name: string; reason: string }>;
        };
        soilImprovement: {
            shortTerm: string[];
            longTerm: string[];
            priority: string;
        };
        problems: Array<{
            type: string;
            severity: string;
            description: string;
            solution: string;
        }>;
        overallScore: {
            value: number;
            label: string;
            summary: string;
        };
        confidence: number;
        additionalNotes: string;
    };
    createdAt: string;
}

export default function SoilAnalysisScreen() {
    const router = useRouter();
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors, isDark);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<SoilAnalysis | null>(null);
    const [history, setHistory] = useState<SoilAnalysis[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [activeTab, setActiveTab] = useState<'analyze' | 'history'>('analyze');
    const [expandedSection, setExpandedSection] = useState<string | null>('overview');

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${API_URL}/soil-analysis/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setHistory(data.map((item: any) => ({
                    id: item.id,
                    imageUrl: item.imageUrl,
                    analysis: item.aiResponse,
                    createdAt: item.analysisDate
                })));
            }
        } catch (error) {
            console.error('Load history error:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const pickImage = async (useCamera: boolean) => {
        try {
            let result;

            if (useCamera) {
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (!permission.granted) {
                    Alert.alert('İzin Gerekli', 'Kamera kullanmak için izin vermelisiniz');
                    return;
                }
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ['images'],  // Güncellenmiş API
                    allowsEditing: true,
                    aspect: [4, 3],
                    quality: 0.8,
                });
            } else {
                const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!permission.granted) {
                    Alert.alert('İzin Gerekli', 'Galeri erişimi için izin vermelisiniz');
                    return;
                }
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],  // Güncellenmiş API
                    allowsEditing: true,
                    aspect: [4, 3],
                    quality: 0.8,
                });
            }

            if (!result.canceled && result.assets[0]) {
                setSelectedImage(result.assets[0].uri);
                setResult(null);
            }
        } catch (error) {
            console.error('Image pick error:', error);
            Alert.alert('Hata', 'Görsel seçilemedi');
        }
    };

    const analyzeImage = async (imageUri: string) => {
        if (!selectedImage) {
            Alert.alert('Hata', 'Lütfen bir görsel seçin');
            return;
        }

        setAnalyzing(true);
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                Alert.alert('Hata', 'Kimlik doğrulama gerekli');
                return;
            }

            const formData = new FormData();
            formData.append('image', {
                uri: imageUri,
                type: 'image/jpeg',
                name: 'soil.jpg',
            } as any);

            console.log('📤 API URL:', API_URL);
            console.log('📤 Sending request to:', `${API_URL}/soil-analysis`);

            const response = await fetch(`${API_URL}/soil-analysis`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            console.log('✅ Response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Response data:', data);

            setResult({
                id: data.id,
                imageUrl: data.imageUrl,
                analysis: data.aiResponse,
                createdAt: data.analysisDate,
            });

            Alert.alert('Başarılı', 'Analiz tamamlandı!');
        } catch (error: any) {
            console.error('❌ Network Error:', error.message);
            Alert.alert('Hata', `Analiz başarısız: ${error.message}`);
        } finally {
            setAnalyzing(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 70) return '#16A34A';
        if (score >= 40) return '#F59E0B';
        return '#EF4444';
    };

    const getMoistureIcon = (level: string) => {
        switch (level?.toLowerCase()) {
            case 'çok kuru': return 'water-outline';
            case 'kuru': return 'water-outline';
            case 'orta': return 'water';
            case 'nemli': return 'water';
            case 'ıslak': return 'rainy';
            default: return 'water';
        }
    };

    const getNutrientColor = (level: string) => {
        switch (level?.toLowerCase()) {
            case 'düşük': return '#EF4444';
            case 'orta': return '#F59E0B';
            case 'yüksek': return '#16A34A';
            default: return colors.textTertiary;
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const renderAnalysisResult = () => {
        if (!result?.analysis) return null;

        const analysis = result.analysis;

        return (
            <ScrollView style={styles.resultContainer} showsVerticalScrollIndicator={false}>
                {/* Görsel */}
                <Image source={{ uri: result.imageUrl }} style={styles.resultImage} />

                {/* Genel Skor */}
                <View style={styles.scoreCard}>
                    <View style={styles.scoreCircle}>
                        <Text style={[styles.scoreValue, { color: getScoreColor(analysis.overallScore?.value || 0) }]}>
                            {analysis.overallScore?.value || 0}
                        </Text>
                        <Text style={styles.scoreLabel}>/ 100</Text>
                    </View>
                    <View style={styles.scoreInfo}>
                        <Text style={[styles.scoreStatus, { color: getScoreColor(analysis.overallScore?.value || 0) }]}>
                            {analysis.overallScore?.label || 'Değerlendiriliyor'}
                        </Text>
                        <Text style={styles.scoreSummary}>{analysis.overallScore?.summary}</Text>
                    </View>
                </View>

                {/* Güven Skoru */}
                <View style={styles.confidenceBadge}>
                    <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
                    <Text style={styles.confidenceText}>Güven: %{analysis.confidence || 0}</Text>
                </View>

                {/* Temel Bilgiler */}
                <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection('overview')}
                >
                    <View style={styles.sectionHeaderLeft}>
                        <Ionicons name="information-circle" size={24} color="#3B82F6" />
                        <Text style={styles.sectionTitle}>Temel Bilgiler</Text>
                    </View>
                    <Ionicons
                        name={expandedSection === 'overview' ? 'chevron-up' : 'chevron-down'}
                        size={24}
                        color={colors.textTertiary}
                    />
                </TouchableOpacity>

                {expandedSection === 'overview' && (
                    <View style={styles.sectionContent}>
                        <View style={styles.infoGrid}>
                            <View style={styles.infoItem}>
                                <Ionicons name="layers" size={24} color="#8B5CF6" />
                                <Text style={styles.infoLabel}>Toprak Tipi</Text>
                                <Text style={styles.infoValue}>{analysis.soilType}</Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Ionicons name="color-palette" size={24} color="#F59E0B" />
                                <Text style={styles.infoLabel}>Renk</Text>
                                <Text style={styles.infoValue}>{analysis.soilColor}</Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Ionicons name={getMoistureIcon(analysis.moistureLevel)} size={24} color="#06B6D4" />
                                <Text style={styles.infoLabel}>Nem</Text>
                                <Text style={styles.infoValue}>{analysis.moistureLevel}</Text>
                                <Text style={styles.infoSubValue}>%{analysis.moisturePercentage}</Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Ionicons name="flask" size={24} color="#EC4899" />
                                <Text style={styles.infoLabel}>pH</Text>
                                <Text style={styles.infoValue}>{analysis.ph?.estimated}</Text>
                                <Text style={styles.infoSubValue}>{analysis.ph?.status}</Text>
                            </View>
                        </View>

                        {/* Doku Bilgisi */}
                        <View style={styles.textureCard}>
                            <Text style={styles.textureTitle}>Toprak Dokusu: {analysis.texture?.class}</Text>
                            <View style={styles.textureBar}>
                                <View style={[styles.textureSegment, { flex: analysis.texture?.sandPercentage || 33, backgroundColor: '#F59E0B' }]}>
                                    <Text style={styles.texturePercent}>Kum %{analysis.texture?.sandPercentage}</Text>
                                </View>
                                <View style={[styles.textureSegment, { flex: analysis.texture?.clayPercentage || 33, backgroundColor: '#EF4444' }]}>
                                    <Text style={styles.texturePercent}>Kil %{analysis.texture?.clayPercentage}</Text>
                                </View>
                                <View style={[styles.textureSegment, { flex: analysis.texture?.siltPercentage || 33, backgroundColor: '#8B5CF6' }]}>
                                    <Text style={styles.texturePercent}>Silt %{analysis.texture?.siltPercentage}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* Besin Durumu */}
                <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection('nutrients')}
                >
                    <View style={styles.sectionHeaderLeft}>
                        <Ionicons name="nutrition" size={24} color="#16A34A" />
                        <Text style={styles.sectionTitle}>Besin Durumu</Text>
                    </View>
                    <Ionicons
                        name={expandedSection === 'nutrients' ? 'chevron-up' : 'chevron-down'}
                        size={24}
                        color={colors.textTertiary}
                    />
                </TouchableOpacity>

                {expandedSection === 'nutrients' && (
                    <View style={styles.sectionContent}>
                        <View style={styles.nutrientGrid}>
                            <View style={styles.nutrientItem}>
                                <Text style={styles.nutrientLabel}>Azot (N)</Text>
                                <View style={[styles.nutrientBadge, { backgroundColor: getNutrientColor(analysis.nutrients?.nitrogen) + '20' }]}>
                                    <Text style={[styles.nutrientValue, { color: getNutrientColor(analysis.nutrients?.nitrogen) }]}>
                                        {analysis.nutrients?.nitrogen}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.nutrientItem}>
                                <Text style={styles.nutrientLabel}>Fosfor (P)</Text>
                                <View style={[styles.nutrientBadge, { backgroundColor: getNutrientColor(analysis.nutrients?.phosphorus) + '20' }]}>
                                    <Text style={[styles.nutrientValue, { color: getNutrientColor(analysis.nutrients?.phosphorus) }]}>
                                        {analysis.nutrients?.phosphorus}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.nutrientItem}>
                                <Text style={styles.nutrientLabel}>Potasyum (K)</Text>
                                <View style={[styles.nutrientBadge, { backgroundColor: getNutrientColor(analysis.nutrients?.potassium) + '20' }]}>
                                    <Text style={[styles.nutrientValue, { color: getNutrientColor(analysis.nutrients?.potassium) }]}>
                                        {analysis.nutrients?.potassium}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <Text style={styles.nutrientDescription}>{analysis.nutrients?.description}</Text>

                        {/* Organik Madde */}
                        <View style={styles.organicCard}>
                            <View style={styles.organicHeader}>
                                <Ionicons name="leaf" size={20} color="#16A34A" />
                                <Text style={styles.organicTitle}>Organik Madde</Text>
                            </View>
                            <Text style={styles.organicValue}>%{analysis.organicMatter?.percentage} - {analysis.organicMatter?.level}</Text>
                            <Text style={styles.organicDescription}>{analysis.organicMatter?.description}</Text>
                        </View>
                    </View>
                )}

                {/* Sulama Önerileri */}
                <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection('irrigation')}
                >
                    <View style={styles.sectionHeaderLeft}>
                        <Ionicons name="water" size={24} color="#06B6D4" />
                        <Text style={styles.sectionTitle}>Sulama Önerileri</Text>
                    </View>
                    <Ionicons
                        name={expandedSection === 'irrigation' ? 'chevron-up' : 'chevron-down'}
                        size={24}
                        color={colors.textTertiary}
                    />
                </TouchableOpacity>

                {expandedSection === 'irrigation' && (
                    <View style={styles.sectionContent}>
                        <View style={[styles.needBadge, {
                            backgroundColor: analysis.irrigation?.currentNeed === 'acil' ? '#FEE2E2' :
                                analysis.irrigation?.currentNeed === 'yakında' ? '#FEF3C7' : '#D1FAE5'
                        }]}>
                            <Ionicons
                                name={analysis.irrigation?.currentNeed === 'acil' ? 'alert-circle' : 'checkmark-circle'}
                                size={20}
                                color={analysis.irrigation?.currentNeed === 'acil' ? '#EF4444' :
                                    analysis.irrigation?.currentNeed === 'yakında' ? '#F59E0B' : '#16A34A'}
                            />
                            <Text style={[styles.needText, {
                                color: analysis.irrigation?.currentNeed === 'acil' ? '#EF4444' :
                                    analysis.irrigation?.currentNeed === 'yakında' ? '#F59E0B' : '#16A34A'
                            }]}>
                                Sulama İhtiyacı: {analysis.irrigation?.currentNeed}
                            </Text>
                        </View>

                        <View style={styles.irrigationDetails}>
                            <View style={styles.irrigationRow}>
                                <Ionicons name="options" size={18} color={colors.textTertiary} />
                                <Text style={styles.irrigationLabel}>Yöntem:</Text>
                                <Text style={styles.irrigationValue}>{analysis.irrigation?.recommendedMethod}</Text>
                            </View>
                            <View style={styles.irrigationRow}>
                                <Ionicons name="refresh" size={18} color={colors.textTertiary} />
                                <Text style={styles.irrigationLabel}>Sıklık:</Text>
                                <Text style={styles.irrigationValue}>{analysis.irrigation?.frequency}</Text>
                            </View>
                            <View style={styles.irrigationRow}>
                                <Ionicons name="beaker" size={18} color={colors.textTertiary} />
                                <Text style={styles.irrigationLabel}>Miktar:</Text>
                                <Text style={styles.irrigationValue}>{analysis.irrigation?.amount}</Text>
                            </View>
                            <View style={styles.irrigationRow}>
                                <Ionicons name="time" size={18} color={colors.textTertiary} />
                                <Text style={styles.irrigationLabel}>En İyi Zaman:</Text>
                                <Text style={styles.irrigationValue}>{analysis.irrigation?.bestTime}</Text>
                            </View>
                        </View>

                        {analysis.irrigation?.warnings?.length > 0 && (
                            <View style={styles.warningsCard}>
                                <Text style={styles.warningsTitle}>⚠️ Uyarılar</Text>
                                {analysis.irrigation.warnings.map((warning, index) => (
                                    <Text key={index} style={styles.warningText}>• {warning}</Text>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* Gübreleme */}
                <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection('fertilization')}
                >
                    <View style={styles.sectionHeaderLeft}>
                        <Ionicons name="flask-outline" size={24} color="#8B5CF6" />
                        <Text style={styles.sectionTitle}>Gübreleme Önerileri</Text>
                    </View>
                    <Ionicons
                        name={expandedSection === 'fertilization' ? 'chevron-up' : 'chevron-down'}
                        size={24}
                        color={colors.textTertiary}
                    />
                </TouchableOpacity>

                {expandedSection === 'fertilization' && (
                    <View style={styles.sectionContent}>
                        {analysis.fertilization?.recommendations?.map((rec, index) => (
                            <View key={index} style={styles.fertilizerCard}>
                                <View style={styles.fertilizerHeader}>
                                    <Text style={styles.fertilizerType}>{rec.type}</Text>
                                    <Text style={styles.fertilizerProduct}>{rec.product}</Text>
                                </View>
                                <View style={styles.fertilizerDetails}>
                                    <Text style={styles.fertilizerDetail}>📏 Miktar: {rec.amount}</Text>
                                    <Text style={styles.fertilizerDetail}>📅 Zaman: {rec.timing}</Text>
                                    <Text style={styles.fertilizerDetail}>🔧 Yöntem: {rec.method}</Text>
                                </View>
                            </View>
                        ))}

                        {analysis.fertilization?.organicOptions?.length > 0 && (
                            <View style={styles.organicOptionsCard}>
                                <Text style={styles.organicOptionsTitle}>🌿 Organik Alternatifler</Text>
                                {analysis.fertilization.organicOptions.map((option, index) => (
                                    <Text key={index} style={styles.organicOption}>• {option}</Text>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* Uygun Ürünler */}
                <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection('crops')}
                >
                    <View style={styles.sectionHeaderLeft}>
                        <Ionicons name="leaf" size={24} color="#16A34A" />
                        <Text style={styles.sectionTitle}>Uygun Ürünler</Text>
                    </View>
                    <Ionicons
                        name={expandedSection === 'crops' ? 'chevron-up' : 'chevron-down'}
                        size={24}
                        color={colors.textTertiary}
                    />
                </TouchableOpacity>

                {expandedSection === 'crops' && (
                    <View style={styles.sectionContent}>
                        {/* Çok Uygun */}
                        {analysis.suitableCrops?.excellent?.length > 0 && (
                            <View style={styles.cropCategory}>
                                <View style={styles.cropCategoryHeader}>
                                    <Text style={styles.cropCategoryIcon}>✅</Text>
                                    <Text style={[styles.cropCategoryTitle, { color: '#16A34A' }]}>Çok Uygun</Text>
                                </View>
                                {analysis.suitableCrops.excellent.map((crop, index) => (
                                    <View key={index} style={styles.cropItem}>
                                        <Text style={styles.cropName}>{crop.name}</Text>
                                        <Text style={styles.cropReason}>{crop.reason}</Text>
                                        {crop.tips && <Text style={styles.cropTips}>💡 {crop.tips}</Text>}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Uygun */}
                        {analysis.suitableCrops?.good?.length > 0 && (
                            <View style={styles.cropCategory}>
                                <View style={styles.cropCategoryHeader}>
                                    <Text style={styles.cropCategoryIcon}>👍</Text>
                                    <Text style={[styles.cropCategoryTitle, { color: '#F59E0B' }]}>Uygun</Text>
                                </View>
                                {analysis.suitableCrops.good.map((crop, index) => (
                                    <View key={index} style={styles.cropItem}>
                                        <Text style={styles.cropName}>{crop.name}</Text>
                                        <Text style={styles.cropReason}>{crop.reason}</Text>
                                        {crop.precautions && <Text style={styles.cropPrecaution}>⚠️ {crop.precautions}</Text>}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Önerilmez */}
                        {analysis.suitableCrops?.notRecommended?.length > 0 && (
                            <View style={styles.cropCategory}>
                                <View style={styles.cropCategoryHeader}>
                                    <Text style={styles.cropCategoryIcon}>❌</Text>
                                    <Text style={[styles.cropCategoryTitle, { color: '#EF4444' }]}>Önerilmez</Text>
                                </View>
                                {analysis.suitableCrops.notRecommended.map((crop, index) => (
                                    <View key={index} style={styles.cropItem}>
                                        <Text style={styles.cropName}>{crop.name}</Text>
                                        <Text style={styles.cropReason}>{crop.reason}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* İyileştirme Önerileri */}
                <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection('improvement')}
                >
                    <View style={styles.sectionHeaderLeft}>
                        <Ionicons name="trending-up" size={24} color="#F59E0B" />
                        <Text style={styles.sectionTitle}>İyileştirme Önerileri</Text>
                    </View>
                    <Ionicons
                        name={expandedSection === 'improvement' ? 'chevron-up' : 'chevron-down'}
                        size={24}
                        color={colors.textTertiary}
                    />
                </TouchableOpacity>

                {expandedSection === 'improvement' && (
                    <View style={styles.sectionContent}>
                        <View style={styles.priorityCard}>
                            <Ionicons name="alert-circle" size={20} color="#EF4444" />
                            <Text style={styles.priorityText}>Öncelik: {analysis.soilImprovement?.priority}</Text>
                        </View>

                        <View style={styles.improvementSection}>
                            <Text style={styles.improvementTitle}>📌 Kısa Vadeli</Text>
                            {analysis.soilImprovement?.shortTerm?.map((item, index) => (
                                <Text key={index} style={styles.improvementItem}>• {item}</Text>
                            ))}
                        </View>

                        <View style={styles.improvementSection}>
                            <Text style={styles.improvementTitle}>🎯 Uzun Vadeli</Text>
                            {analysis.soilImprovement?.longTerm?.map((item, index) => (
                                <Text key={index} style={styles.improvementItem}>• {item}</Text>
                            ))}
                        </View>
                    </View>
                )}

                {/* Ek Notlar */}
                {analysis.additionalNotes && (
                    <View style={styles.notesCard}>
                        <Text style={styles.notesTitle}>📝 Ek Notlar</Text>
                        <Text style={styles.notesText}>{analysis.additionalNotes}</Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        );
    };

    const renderHistory = () => (
        <ScrollView
            style={styles.historyContainer}
            refreshControl={
                <RefreshControl refreshing={loadingHistory} onRefresh={loadHistory} />
            }
        >
            {history.length === 0 ? (
                <View style={styles.emptyHistory}>
                    <Ionicons name="document-text-outline" size={60} color={colors.textTertiary} />
                    <Text style={styles.emptyHistoryText}>Henüz analiz yapılmadı</Text>
                    <Text style={styles.emptyHistorySubtext}>İlk toprak analizinizi yapın</Text>
                </View>
            ) : (
                history.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.historyCard}
                        onPress={() => {
                            setResult(item);
                            setActiveTab('analyze');
                        }}
                    >
                        <Image source={{ uri: item.imageUrl }} style={styles.historyImage} />
                        <View style={styles.historyInfo}>
                            <Text style={styles.historyType}>{item.analysis?.soilType || 'Bilinmiyor'}</Text>
                            <Text style={styles.historyScore}>
                                Skor: {item.analysis?.overallScore?.value || 0}/100
                            </Text>
                            <Text style={styles.historyDate}>
                                {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
                    </TouchableOpacity>
                ))
            )}
        </ScrollView>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>🔬 Toprak Analizi</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'analyze' && styles.activeTab]}
                    onPress={() => setActiveTab('analyze')}
                >
                    <Ionicons
                        name="scan"
                        size={20}
                        color={activeTab === 'analyze' ? colors.primary : colors.textTertiary}
                    />
                    <Text style={[styles.tabText, activeTab === 'analyze' && styles.activeTabText]}>
                        Analiz
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'history' && styles.activeTab]}
                    onPress={() => setActiveTab('history')}
                >
                    <Ionicons
                        name="time"
                        size={20}
                        color={activeTab === 'history' ? colors.primary : colors.textTertiary}
                    />
                    <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
                        Geçmiş ({history.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'analyze' ? (
                result ? (
                    <>
                        {renderAnalysisResult()}
                        <TouchableOpacity
                            style={styles.newAnalysisButton}
                            onPress={() => {
                                setResult(null);
                                setSelectedImage(null);
                            }}
                        >
                            <Ionicons name="add" size={24} color="#fff" />
                            <Text style={styles.newAnalysisText}>Yeni Analiz</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <ScrollView contentContainerStyle={styles.analyzeContent}>
                        {/* Görsel Seçimi */}
                        <View style={styles.imageSection}>
                            {selectedImage ? (
                                <View style={styles.selectedImageContainer}>
                                    <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                                    <TouchableOpacity
                                        style={styles.removeImageButton}
                                        onPress={() => setSelectedImage(null)}
                                    >
                                        <Ionicons name="close-circle" size={32} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.imagePlaceholder}>
                                    <Ionicons name="image-outline" size={80} color={colors.textTertiary} />
                                    <Text style={styles.placeholderText}>Toprak fotoğrafı seçin</Text>
                                </View>
                            )}
                        </View>

                        {/* Butonlar */}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.pickButton}
                                onPress={() => pickImage(true)}
                            >
                                <Ionicons name="camera" size={28} color="#fff" />
                                <Text style={styles.pickButtonText}>Fotoğraf Çek</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.pickButton, styles.galleryButton]}
                                onPress={() => pickImage(false)}
                            >
                                <Ionicons name="images" size={28} color="#fff" />
                                <Text style={styles.pickButtonText}>Galeriden Seç</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Analiz Butonu */}
                        <TouchableOpacity
                            style={[styles.analyzeButton, !selectedImage && styles.analyzeButtonDisabled]}
                            onPress={() => analyzeImage(selectedImage!)}
                            disabled={!selectedImage || analyzing}
                        >
                            {analyzing ? (
                                <>
                                    <ActivityIndicator size="small" color="#fff" />
                                    <Text style={styles.analyzeButtonText}>Analiz Yapılıyor...</Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="scan" size={24} color="#fff" />
                                    <Text style={styles.analyzeButtonText}>Analizi Başlat</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* İpuçları */}
                        <View style={styles.tipsCard}>
                            <Text style={styles.tipsTitle}>📸 İyi Bir Fotoğraf İçin</Text>
                            <Text style={styles.tipItem}>• Gün ışığında çekin</Text>
                            <Text style={styles.tipItem}>• Toprağı yakından çekin (30-50 cm)</Text>
                            <Text style={styles.tipItem}>• Farklı derinliklerden örnek alın</Text>
                            <Text style={styles.tipItem}>• Islak ve kuru toprağı karşılaştırın</Text>
                        </View>
                    </ScrollView>
                )
            ) : (
                renderHistory()
            )}
        </SafeAreaView>
    );
}

const createStyles = (colors: {
    background: string;
    surface: string;
    surfaceLight: string;
    inputBackground: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    primary: string;
    border: string;
    borderLight: string;
    warning: string;
    error: string;
}, isDark: boolean) => {
    const tabBackground = isDark ? '#0f172a' : colors.inputBackground;
    const activeTabBackground = isDark ? '#14532d' : '#dcfce7';
    const confidenceBackground = isDark ? '#14532d' : '#dcfce7';
    const warningBackground = isDark ? '#451a03' : '#fffbeb';
    const warningText = isDark ? '#fcd34d' : '#92400E';
    const organicBackground = isDark ? '#14532d' : '#ecfccb';
    const organicText = isDark ? '#86efac' : '#166534';
    const priorityBackground = isDark ? '#450a0a' : '#fef2f2';
    const priorityText = isDark ? '#fca5a5' : '#b91c1c';
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            backgroundColor: colors.surface,
        },
        backButton: {
            padding: 8,
        },
        headerTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: colors.text,
        },
        tabs: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            paddingBottom: 12,
            gap: 12,
        },
        tab: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 12,
            borderRadius: 10,
            backgroundColor: tabBackground,
        },
        activeTab: {
            backgroundColor: activeTabBackground,
        },
        tabText: {
            fontSize: 14,
            color: colors.textSecondary,
            fontWeight: '500',
        },
        activeTabText: {
            color: colors.primary,
        },
        analyzeContent: {
            padding: 16,
            gap: 20,
        },
        imageSection: {
            alignItems: 'center',
        },
        imagePlaceholder: {
            width: '100%',
            height: 250,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: colors.border,
            borderStyle: 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
        },
        placeholderText: {
            color: colors.textSecondary,
            fontSize: 16,
        },
        selectedImageContainer: {
            width: '100%',
            position: 'relative',
        },
        selectedImage: {
            width: '100%',
            height: 250,
            borderRadius: 16,
        },
        removeImageButton: {
            position: 'absolute',
            top: 10,
            right: 10,
        },
        buttonContainer: {
            flexDirection: 'row',
            gap: 12,
        },
        pickButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: '#3B82F6',
            paddingVertical: 16,
            borderRadius: 12,
        },
        galleryButton: {
            backgroundColor: '#8B5CF6',
        },
        pickButtonText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '600',
        },
        analyzeButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: colors.primary,
            paddingVertical: 18,
            borderRadius: 12,
        },
        analyzeButtonDisabled: {
            backgroundColor: colors.border,
        },
        analyzeButtonText: {
            color: '#fff',
            fontSize: 18,
            fontWeight: 'bold',
        },
        tipsCard: {
            backgroundColor: colors.surface,
            padding: 16,
            borderRadius: 12,
            borderLeftWidth: 4,
            borderLeftColor: colors.warning,
        },
        tipsTitle: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 12,
        },
        tipItem: {
            color: colors.textSecondary,
            fontSize: 14,
            marginBottom: 6,
        },

        // Result styles
        resultContainer: {
            flex: 1,
            padding: 16,
        },
        resultImage: {
            width: '100%',
            height: 200,
            borderRadius: 16,
            marginBottom: 16,
        },
        scoreCard: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            padding: 20,
            borderRadius: 16,
            alignItems: 'center',
            gap: 20,
            marginBottom: 12,
        },
        scoreCircle: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.inputBackground,
            alignItems: 'center',
            justifyContent: 'center',
        },
        scoreValue: {
            fontSize: 28,
            fontWeight: 'bold',
        },
        scoreLabel: {
            color: colors.textTertiary,
            fontSize: 12,
        },
        scoreInfo: {
            flex: 1,
        },
        scoreStatus: {
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 4,
        },
        scoreSummary: {
            color: colors.textSecondary,
            fontSize: 14,
        },
        confidenceBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: 6,
            backgroundColor: confidenceBackground,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            marginBottom: 16,
        },
        confidenceText: {
            color: colors.primary,
            fontSize: 13,
            fontWeight: '500',
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            padding: 16,
            borderRadius: 12,
            marginBottom: 2,
        },
        sectionHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        sectionTitle: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
        },
        sectionContent: {
            backgroundColor: colors.surface,
            padding: 16,
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
            marginBottom: 12,
        },
        infoGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        infoItem: {
            width: '47%',
            backgroundColor: colors.inputBackground,
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            gap: 8,
        },
        infoLabel: {
            color: colors.textSecondary,
            fontSize: 12,
        },
        infoValue: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
        },
        infoSubValue: {
            color: colors.textTertiary,
            fontSize: 12,
        },
        textureCard: {
            marginTop: 16,
            backgroundColor: colors.inputBackground,
            padding: 16,
            borderRadius: 12,
        },
        textureTitle: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '500',
            marginBottom: 12,
        },
        textureBar: {
            flexDirection: 'row',
            height: 40,
            borderRadius: 8,
            overflow: 'hidden',
        },
        textureSegment: {
            justifyContent: 'center',
            alignItems: 'center',
        },
        texturePercent: {
            color: '#fff',
            fontSize: 10,
            fontWeight: '600',
        },
        nutrientGrid: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 12,
        },
        nutrientItem: {
            flex: 1,
            alignItems: 'center',
            gap: 8,
        },
        nutrientLabel: {
            color: colors.textSecondary,
            fontSize: 12,
        },
        nutrientBadge: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
        },
        nutrientValue: {
            fontSize: 14,
            fontWeight: '600',
        },
        nutrientDescription: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        organicCard: {
            marginTop: 16,
            backgroundColor: colors.inputBackground,
            padding: 16,
            borderRadius: 12,
        },
        organicHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
        },
        organicTitle: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '500',
        },
        organicValue: {
            color: '#16A34A',
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 6,
        },
        organicDescription: {
            color: colors.textSecondary,
            fontSize: 13,
        },
        needBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderRadius: 10,
            marginBottom: 16,
        },
        needText: {
            fontSize: 15,
            fontWeight: '600',
        },
        irrigationDetails: {
            gap: 10,
        },
        irrigationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        irrigationLabel: {
            color: colors.textSecondary,
            fontSize: 14,
        },
        irrigationValue: {
            color: colors.text,
            fontSize: 14,
            flex: 1,
        },
        warningsCard: {
            marginTop: 16,
            backgroundColor: warningBackground,
            padding: 12,
            borderRadius: 10,
        },
        warningsTitle: {
            color: colors.warning,
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 8,
        },
        warningText: {
            color: warningText,
            fontSize: 13,
            marginBottom: 4,
        },
        fertilizerCard: {
            backgroundColor: colors.inputBackground,
            padding: 14,
            borderRadius: 10,
            marginBottom: 10,
        },
        fertilizerHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
        },
        fertilizerType: {
            color: '#8B5CF6',
            fontSize: 14,
            fontWeight: '600',
        },
        fertilizerProduct: {
            color: colors.text,
            fontSize: 14,
        },
        fertilizerDetails: {
            gap: 4,
        },
        fertilizerDetail: {
            color: colors.textSecondary,
            fontSize: 13,
        },
        organicOptionsCard: {
            backgroundColor: organicBackground,
            padding: 14,
            borderRadius: 10,
        },
        organicOptionsTitle: {
            color: colors.primary,
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 8,
        },
        organicOption: {
            color: organicText,
            fontSize: 13,
            marginBottom: 4,
        },
        cropCategory: {
            marginBottom: 16,
        },
        cropCategoryHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
        },
        cropCategoryIcon: {
            fontSize: 18,
        },
        cropCategoryTitle: {
            fontSize: 16,
            fontWeight: '600',
        },
        cropItem: {
            backgroundColor: colors.inputBackground,
            padding: 12,
            borderRadius: 10,
            marginBottom: 8,
        },
        cropName: {
            color: colors.text,
            fontSize: 15,
            fontWeight: '600',
            marginBottom: 4,
        },
        cropReason: {
            color: colors.textSecondary,
            fontSize: 13,
        },
        cropTips: {
            color: '#16A34A',
            fontSize: 12,
            marginTop: 6,
        },
        cropPrecaution: {
            color: '#F59E0B',
            fontSize: 12,
            marginTop: 6,
        },
        priorityCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: priorityBackground,
            padding: 12,
            borderRadius: 10,
            marginBottom: 16,
        },
        priorityText: {
            color: priorityText,
            fontSize: 14,
            fontWeight: '600',
        },
        improvementSection: {
            marginBottom: 16,
        },
        improvementTitle: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 8,
        },
        improvementItem: {
            color: colors.textSecondary,
            fontSize: 13,
            marginBottom: 4,
        },
        notesCard: {
            backgroundColor: colors.surface,
            padding: 16,
            borderRadius: 12,
            marginTop: 8,
        },
        notesTitle: {
            color: colors.text,
            fontSize: 15,
            fontWeight: '600',
            marginBottom: 8,
        },
        notesText: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        newAnalysisButton: {
            position: 'absolute',
            bottom: 20,
            right: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.primary,
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderRadius: 30,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
        },
        newAnalysisText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '600',
        },

        // History styles
        historyContainer: {
            flex: 1,
            padding: 16,
        },
        emptyHistory: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 60,
            gap: 12,
        },
        emptyHistoryText: {
            color: colors.text,
            fontSize: 18,
            fontWeight: '600',
        },
        emptyHistorySubtext: {
            color: colors.textSecondary,
            fontSize: 14,
        },
        historyCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
            gap: 14,
        },
        historyImage: {
            width: 70,
            height: 70,
            borderRadius: 10,
        },
        historyInfo: {
            flex: 1,
        },
        historyType: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 4,
        },
        historyScore: {
            color: colors.primary,
            fontSize: 14,
        },
        historyDate: {
            color: colors.textSecondary,
            fontSize: 12,
            marginTop: 4,
        },
    });
};