import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { LineChart } from '../components/LineChart';
import { StatsCard } from '../components/StatsCard';
import { fetchWasteStats, fetchEnhancedWasteStats } from '../services/aiService';
import { Toast } from '../components/Toast';
import { getCategoryName } from '../data/categories';

export function StatisticsScreen() {
  const [trend, setTrend] = useState([]);
  const [summary, setSummary] = useState({ total: '0', delta: '0%' });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const stats = await fetchEnhancedWasteStats();
        setTrend(stats.trend);
        setSummary(stats.summary);
        setCategoryBreakdown(stats.categoryBreakdown || []);
      } catch (err) {
        console.error('Failed to load waste stats', err);
        // Fallback to basic stats
        try {
          const basicStats = await fetchWasteStats();
          setTrend(basicStats.trend);
          setSummary(basicStats.summary);
        } catch (fallbackErr) {
          setError(err?.message || 'Unable to load statistics.');
          Toast.show({
            type: 'error',
            text1: 'Stats Error',
            text2: 'Unable to load your food waste statistics.',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header}>Statistics</Text>
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading your food waste stats...</Text>
        </View>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Food waste</Text>
          <Text style={styles.chartValue}>{summary.total}</Text>
        </View>
        <LineChart data={trend} />
      </View>

      <View style={styles.statsRow}>
        <StatsCard
          title="Total waste"
          value={summary.total}
          accent={theme.colors.primary}
        />
        <StatsCard title="Change" value={summary.delta} accent={theme.colors.accent} />
      </View>

      <View style={styles.statsRow}>
        <StatsCard
          title="Saved value"
          value={summary.saved_value_formatted || '0.00'}
          accent={theme.colors.primary}
        />
        <StatsCard
          title="Wasted value"
          value={summary.wasted_value_formatted || '0.00'}
          accent={theme.colors.danger}
        />
      </View>

      {categoryBreakdown.length > 0 && (
        <View style={styles.categorySection}>
          <Text style={styles.sectionTitle}>Waste by Category</Text>
          {categoryBreakdown.map((cat, index) => (
            <View key={index} style={styles.categoryCard}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>
                  {cat.category === 'Uncategorized' ? '📦 Uncategorized' : getCategoryName(cat.category)}
                </Text>
                <View style={styles.categoryStats}>
                  <Text style={[styles.categoryStat, styles.categoryStatGood]}>
                    ✓ {cat.saved_count}
                  </Text>
                  <Text style={[styles.categoryStat, styles.categoryStatBad]}>
                    ✗ {cat.wasted_count}
                  </Text>
                </View>
              </View>
              <View style={styles.categoryValues}>
                <Text style={styles.categoryValueText}>
                  Saved: {cat.saved_value.toFixed(2)}
                </Text>
                <Text style={[styles.categoryValueText, styles.categoryValueTextBad]}>
                  Wasted: {cat.wasted_value.toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 120,
  },
  header: {
    fontFamily: theme.typography.bold,
    fontSize: 32,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  chartCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.cardRadius,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.card,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: theme.spacing.sm,
  },
  chartTitle: {
    fontFamily: theme.typography.semibold,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  chartValue: {
    fontFamily: theme.typography.bold,
    fontSize: 24,
    color: theme.colors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.shapes.buttonRadius,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: theme.typography.semibold,
    color: '#fff',
    fontSize: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  loadingText: {
    fontFamily: theme.typography.medium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  errorText: {
    fontFamily: theme.typography.medium,
    fontSize: 13,
    color: theme.colors.danger,
    marginBottom: theme.spacing.sm,
  },
  categorySection: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: theme.typography.bold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  categoryCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.cardRadius,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  categoryName: {
    fontFamily: theme.typography.semibold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  categoryStats: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  categoryStat: {
    fontFamily: theme.typography.medium,
    fontSize: 14,
  },
  categoryStatGood: {
    color: theme.colors.primary,
  },
  categoryStatBad: {
    color: theme.colors.danger,
  },
  categoryValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  categoryValueText: {
    fontFamily: theme.typography.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  categoryValueTextBad: {
    color: theme.colors.danger,
  },
});


