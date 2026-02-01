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
import { API_URL } from '../../config';

interface Field {
    id: string;
    name: string;
    cropType: string;
    soilType: string;
}

interface IrrigationTask {
    id: string;
    fieldId: string;
    fieldName: string;
    date: string;
    time: string;
    waterAmount: number;
    completed: boolean;
    cropType: string;
}

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export default function CalendarScreen() {
    const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
    const [fields, setFields] = useState<Field[]>([]);
    const [tasks, setTasks] = useState<IrrigationTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
    const [currentMonth, setCurrentMonth] = useState<Date[][]>([]);

    useEffect(() => {
        generateWeekDays();
        generateMonthDays();
        loadData();
    }, [selectedDate]);

    const generateWeekDays = () => {
        const week: Date[] = [];
        const start = new Date(selectedDate);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);

        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            week.push(date);
        }
        setCurrentWeek(week);
    };

    const generateMonthDays = () => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const weeks: Date[][] = [];
        let week: Date[] = [];

        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        for (let i = startDay; i > 0; i--) {
            const date = new Date(year, month, 1 - i);
            week.push(date);
        }

        for (let i = 1; i <= lastDay.getDate(); i++) {
            if (week.length === 7) {
                weeks.push(week);
                week = [];
            }
            week.push(new Date(year, month, i));
        }

        let nextDay = 1;
        while (week.length < 7) {
            week.push(new Date(year, month + 1, nextDay++));
        }
        weeks.push(week);

        setCurrentMonth(weeks);
    };

    const loadData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');

            // Gerçek tarlaları çek
            const fieldsResponse = await fetch(`${API_URL}/fields`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (fieldsResponse.ok) {
                const fieldsData = await fieldsResponse.json();
                const fieldsList = Array.isArray(fieldsData) ? fieldsData : [];
                setFields(fieldsList);

                // Her tarla için sulama görevleri oluştur
                const generatedTasks = generateIrrigationTasks(fieldsList);
                setTasks(generatedTasks);
            }
        } catch (error) {
            console.error('Load data error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Tarla bilgilerine göre sulama görevleri oluştur
    const generateIrrigationTasks = (fieldsList: Field[]): IrrigationTask[] => {
        const tasks: IrrigationTask[] = [];
        const today = new Date();

        fieldsList.forEach((field) => {
            // Her tarla için sulama sıklığını belirle (ürün tipine göre)
            const irrigationInterval = getIrrigationInterval(field.cropType);
            const irrigationTime = getIrrigationTime(field.cropType);
            const waterAmount = calculateWaterAmount(field.soilType, field.cropType);

            // Önümüzdeki 14 gün için görevler oluştur
            for (let i = 0; i < 14; i++) {
                if (i % irrigationInterval === 0) {
                    const taskDate = new Date(today);
                    taskDate.setDate(today.getDate() + i);

                    tasks.push({
                        id: `${field.id}-${i}`,
                        fieldId: field.id,
                        fieldName: field.name,
                        date: formatDate(taskDate),
                        time: irrigationTime,
                        waterAmount: waterAmount,
                        completed: i < 0, // Geçmiş günler tamamlanmış
                        cropType: field.cropType
                    });
                }
            }
        });

        return tasks.sort((a, b) => a.date.localeCompare(b.date));
    };

    // Ürün tipine göre sulama sıklığı (gün)
    const getIrrigationInterval = (cropType: string): number => {
        const intervals: { [key: string]: number } = {
            'Buğday': 4,
            'Mısır': 2,
            'Domates': 1,
            'Biber': 2,
            'Patates': 3,
            'Ayçiçeği': 5,
            'Pamuk': 3,
            'Üzüm': 4,
            'Zeytin': 7,
            'Elma': 3,
        };
        return intervals[cropType] || 3;
    };

    // Ürün tipine göre önerilen sulama saati
    const getIrrigationTime = (cropType: string): string => {
        const times: { [key: string]: string } = {
            'Buğday': '06:00',
            'Mısır': '05:30',
            'Domates': '07:00',
            'Biber': '06:30',
            'Patates': '06:00',
            'Ayçiçeği': '05:00',
            'Pamuk': '05:30',
            'Üzüm': '06:00',
            'Zeytin': '07:00',
            'Elma': '06:30',
        };
        return times[cropType] || '06:00';
    };

    // Toprak ve ürün tipine göre su miktarı (litre)
    const calculateWaterAmount = (soilType: string, cropType: string): number => {
        const baseAmount: { [key: string]: number } = {
            'Buğday': 400,
            'Mısır': 600,
            'Domates': 500,
            'Biber': 450,
            'Patates': 550,
            'Ayçiçeği': 350,
            'Pamuk': 500,
            'Üzüm': 300,
            'Zeytin': 250,
            'Elma': 400,
        };

        const soilFactor: { [key: string]: number } = {
            'Kumlu': 1.3,
            'Killi': 0.8,
            'Tınlı': 1.0,
            'Balçık': 0.9,
            'Çakıllı': 1.4,
        };

        const base = baseAmount[cropType] || 400;
        const factor = soilFactor[soilType] || 1.0;

        return Math.round(base * factor);
    };

    const formatDate = (date: Date): string => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const isToday = (date: Date): boolean => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isSelected = (date: Date): boolean => {
        return date.toDateString() === selectedDate.toDateString();
    };

    const isCurrentMonth = (date: Date): boolean => {
        return date.getMonth() === selectedDate.getMonth();
    };

    const getTasksForDate = (date: Date): IrrigationTask[] => {
        return tasks.filter(task => task.date === formatDate(date));
    };

    const hasTasksOnDate = (date: Date): boolean => {
        return getTasksForDate(date).length > 0;
    };

    const navigateWeek = (direction: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + (direction * 7));
        setSelectedDate(newDate);
    };

    const navigateMonth = (direction: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + direction);
        setSelectedDate(newDate);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const toggleTaskComplete = (taskId: string) => {
        setTasks(prev => prev.map(task =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
        ));
    };

    const getCropIcon = (cropType: string): string => {
        const icons: { [key: string]: string } = {
            'Buğday': '🌾',
            'Mısır': '🌽',
            'Domates': '🍅',
            'Biber': '🌶️',
            'Patates': '🥔',
            'Üzüm': '🍇',
            'Zeytin': '🫒',
            'Elma': '🍎',
            'Ayçiçeği': '🌻',
            'Pamuk': '☁️',
        };
        return icons[cropType] || '🌱';
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
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>📅 Sulama Takvimi</Text>
                <Text style={styles.headerSubtitle}>
                    {fields.length} tarla için planlama
                </Text>
            </View>

            {/* View Mode Toggle */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleButton, viewMode === 'weekly' && styles.toggleButtonActive]}
                    onPress={() => setViewMode('weekly')}
                >
                    <Text style={[styles.toggleText, viewMode === 'weekly' && styles.toggleTextActive]}>
                        Haftalık
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleButton, viewMode === 'monthly' && styles.toggleButtonActive]}
                    onPress={() => setViewMode('monthly')}
                >
                    <Text style={[styles.toggleText, viewMode === 'monthly' && styles.toggleTextActive]}>
                        Aylık
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Navigation */}
            <View style={styles.navigation}>
                <TouchableOpacity
                    onPress={() => viewMode === 'weekly' ? navigateWeek(-1) : navigateMonth(-1)}
                    style={styles.navButton}
                >
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>
                    {viewMode === 'weekly'
                        ? `${currentWeek[0]?.getDate()} - ${currentWeek[6]?.getDate()} ${MONTHS[selectedDate.getMonth()]}`
                        : `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
                    }
                </Text>
                <TouchableOpacity
                    onPress={() => viewMode === 'weekly' ? navigateWeek(1) : navigateMonth(1)}
                    style={styles.navButton}
                >
                    <Ionicons name="chevron-forward" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Weekly View */}
            {viewMode === 'weekly' && (
                <View style={styles.weekContainer}>
                    <View style={styles.weekDays}>
                        {currentWeek.map((date, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.dayColumn,
                                    isSelected(date) && styles.dayColumnSelected,
                                    isToday(date) && styles.dayColumnToday
                                ]}
                                onPress={() => setSelectedDate(date)}
                            >
                                <Text style={styles.dayName}>{DAYS[index]}</Text>
                                <Text style={[
                                    styles.dayNumber,
                                    isToday(date) && styles.dayNumberToday
                                ]}>
                                    {date.getDate()}
                                </Text>
                                {hasTasksOnDate(date) && (
                                    <View style={styles.taskDot} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Monthly View */}
            {viewMode === 'monthly' && (
                <View style={styles.monthContainer}>
                    <View style={styles.monthHeader}>
                        {DAYS.map((day, index) => (
                            <Text key={index} style={styles.monthDayName}>{day}</Text>
                        ))}
                    </View>
                    {currentMonth.map((week, weekIndex) => (
                        <View key={weekIndex} style={styles.monthWeek}>
                            {week.map((date, dayIndex) => (
                                <TouchableOpacity
                                    key={dayIndex}
                                    style={[
                                        styles.monthDay,
                                        isSelected(date) && styles.monthDaySelected,
                                        isToday(date) && styles.monthDayToday,
                                        !isCurrentMonth(date) && styles.monthDayOther
                                    ]}
                                    onPress={() => setSelectedDate(date)}
                                >
                                    <Text style={[
                                        styles.monthDayNumber,
                                        !isCurrentMonth(date) && styles.monthDayNumberOther
                                    ]}>
                                        {date.getDate()}
                                    </Text>
                                    {hasTasksOnDate(date) && (
                                        <View style={styles.taskDotSmall} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))}
                </View>
            )}

            {/* Tasks for Selected Date */}
            <View style={styles.tasksSection}>
                <Text style={styles.tasksTitle}>
                    {isToday(selectedDate) ? 'Bugünkü Görevler' : `${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]} Görevleri`}
                </Text>

                {fields.length === 0 ? (
                    <View style={styles.noTasks}>
                        <Ionicons name="leaf-outline" size={48} color="#64748b" />
                        <Text style={styles.noTasksText}>Henüz tarla eklemediniz</Text>
                        <Text style={styles.noTasksSubtext}>
                            Sulama takvimi için tarla ekleyin
                        </Text>
                    </View>
                ) : getTasksForDate(selectedDate).length === 0 ? (
                    <View style={styles.noTasks}>
                        <Ionicons name="checkmark-circle-outline" size={48} color="#64748b" />
                        <Text style={styles.noTasksText}>Bu gün için sulama görevi yok</Text>
                    </View>
                ) : (
                    getTasksForDate(selectedDate).map((task) => (
                        <TouchableOpacity
                            key={task.id}
                            style={[styles.taskCard, task.completed && styles.taskCardCompleted]}
                            onPress={() => toggleTaskComplete(task.id)}
                        >
                            <View style={styles.taskCheckbox}>
                                <Ionicons
                                    name={task.completed ? "checkmark-circle" : "ellipse-outline"}
                                    size={28}
                                    color={task.completed ? "#16A34A" : "#64748b"}
                                />
                            </View>
                            <View style={styles.taskInfo}>
                                <View style={styles.taskHeader}>
                                    <Text style={[styles.taskFieldName, task.completed && styles.taskTextCompleted]}>
                                        {task.fieldName}
                                    </Text>
                                    <Text style={styles.taskCropIcon}>{getCropIcon(task.cropType)}</Text>
                                </View>
                                <Text style={styles.taskCrop}>{task.cropType}</Text>
                                <View style={styles.taskDetails}>
                                    <View style={styles.taskDetail}>
                                        <Ionicons name="time-outline" size={14} color="#3B82F6" />
                                        <Text style={styles.taskDetailText}>{task.time}</Text>
                                    </View>
                                    <View style={styles.taskDetail}>
                                        <Ionicons name="water" size={14} color="#06B6D4" />
                                        <Text style={styles.taskDetailText}>{task.waterAmount} L</Text>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </View>

            {/* Summary */}
            {fields.length > 0 && (
                <View style={styles.summarySection}>
                    <Text style={styles.summaryTitle}>📊 Haftalık Özet</Text>
                    <View style={styles.summaryCards}>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryValue}>
                                {tasks.filter(t => {
                                    const taskDate = new Date(t.date);
                                    const weekStart = currentWeek[0];
                                    const weekEnd = currentWeek[6];
                                    return taskDate >= weekStart && taskDate <= weekEnd;
                                }).length}
                            </Text>
                            <Text style={styles.summaryLabel}>Toplam Sulama</Text>
                        </View>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryValue}>
                                {tasks.filter(t => {
                                    const taskDate = new Date(t.date);
                                    const weekStart = currentWeek[0];
                                    const weekEnd = currentWeek[6];
                                    return taskDate >= weekStart && taskDate <= weekEnd;
                                }).reduce((sum, t) => sum + t.waterAmount, 0)} L
                            </Text>
                            <Text style={styles.summaryLabel}>Toplam Su</Text>
                        </View>
                    </View>
                </View>
            )}

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
    header: {
        padding: 20,
        paddingTop: 60,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    toggleContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 4,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 10,
    },
    toggleButtonActive: {
        backgroundColor: '#16A34A',
    },
    toggleText: {
        color: '#94a3b8',
        fontWeight: '600',
    },
    toggleTextActive: {
        color: '#fff',
    },
    navigation: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    navButton: {
        padding: 8,
    },
    navTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    weekContainer: {
        paddingHorizontal: 10,
    },
    weekDays: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    dayColumn: {
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        minWidth: 45,
    },
    dayColumnSelected: {
        backgroundColor: '#16A34A',
    },
    dayColumnToday: {
        borderWidth: 2,
        borderColor: '#16A34A',
    },
    dayName: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 4,
    },
    dayNumber: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    dayNumberToday: {
        color: '#16A34A',
    },
    taskDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#F59E0B',
        marginTop: 4,
    },
    monthContainer: {
        paddingHorizontal: 10,
    },
    monthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 8,
    },
    monthDayName: {
        fontSize: 12,
        color: '#94a3b8',
        width: 40,
        textAlign: 'center',
    },
    monthWeek: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 4,
    },
    monthDay: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
    },
    monthDaySelected: {
        backgroundColor: '#16A34A',
    },
    monthDayToday: {
        borderWidth: 2,
        borderColor: '#16A34A',
    },
    monthDayOther: {
        opacity: 0.3,
    },
    monthDayNumber: {
        fontSize: 14,
        color: '#fff',
    },
    monthDayNumberOther: {
        color: '#64748b',
    },
    taskDotSmall: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#F59E0B',
        position: 'absolute',
        bottom: 4,
    },
    tasksSection: {
        padding: 20,
    },
    tasksTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 16,
    },
    noTasks: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#1e293b',
        borderRadius: 16,
    },
    noTasksText: {
        color: '#94a3b8',
        marginTop: 12,
        fontSize: 16,
    },
    noTasksSubtext: {
        color: '#64748b',
        marginTop: 4,
        fontSize: 14,
    },
    taskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
    },
    taskCardCompleted: {
        opacity: 0.6,
    },
    taskCheckbox: {
        marginRight: 12,
    },
    taskInfo: {
        flex: 1,
    },
    taskHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    taskFieldName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    taskCropIcon: {
        fontSize: 20,
    },
    taskTextCompleted: {
        textDecorationLine: 'line-through',
    },
    taskCrop: {
        fontSize: 14,
        color: '#16A34A',
        marginTop: 2,
    },
    taskDetails: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 8,
    },
    taskDetail: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    taskDetailText: {
        fontSize: 13,
        color: '#94a3b8',
    },
    summarySection: {
        padding: 20,
        paddingTop: 0,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    summaryCards: {
        flexDirection: 'row',
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#16A34A',
    },
    summaryLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
});