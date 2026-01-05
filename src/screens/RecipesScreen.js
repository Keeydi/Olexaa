import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme';
import { fetchAiRecipes } from '../services/aiService';
import { Toast } from '../components/Toast';

export function RecipesScreen({ data, pantryItems, onBack }) {
  const [query, setQuery] = useState('');
  const [aiRecipes, setAiRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allRecipes = useMemo(() => {
    const combined = [...(data || []), ...aiRecipes];
    if (!query.trim()) {
      return combined;
    }
    return combined.filter((recipe) =>
      recipe.title.toLowerCase().includes(query.toLowerCase()),
    );
  }, [data, aiRecipes, query]);

  useEffect(() => {
    // If no local recipes and we have pantry items, try to fetch AI recipes
    if ((data?.length ?? 0) === 0 && pantryItems?.length) {
      const load = async () => {
        setLoading(true);
        setError('');
        try {
          const recipes = await fetchAiRecipes(pantryItems);
          setAiRecipes(recipes);
        } catch (err) {
          console.error('Failed to load AI recipes', err);
          setError('Could not load AI recipes. Please try again later.');
          Toast.show({
            type: 'error',
            text1: 'AI unavailable',
            text2: 'Could not load recipe suggestions.',
          });
        } finally {
          setLoading(false);
        }
      };

      load();
    }
  }, [data, pantryItems]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather
              name="chevron-left"
              size={20}
              color={theme.colors.textPrimary}
            />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
        ) : (
          // Keep spacing even if no back button is provided
          <View style={styles.backButtonPlaceholder} />
        )}
        <Text style={styles.header}>Recipes</Text>
        {/* Right-side placeholder to keep title centered */}
        <View style={styles.backButtonPlaceholder} />
      </View>
      <TextInput
        placeholder="Search ingredients or titles"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      {loading ? (
        <Text style={styles.loadingText}>Getting AI recipe ideas...</Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {allRecipes.map((recipe) => (
          <View key={recipe.id} style={styles.card}>
            <Text style={styles.title}>{recipe.title}</Text>
            <Text style={styles.meta}>
              {recipe.ingredients.join(' • ')}
            </Text>
            <Text style={styles.instructions}>{recipe.instructions}</Text>
          </View>
        ))}
        {!allRecipes.length && !loading ? (
          <Text style={styles.empty}>No recipes found yet.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  header: {
    fontFamily: theme.typography.bold,
    fontSize: 24,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.buttonRadius,
    ...theme.shadow.card,
  },
  backLabel: {
    marginLeft: 6,
    fontFamily: theme.typography.medium,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  backButtonPlaceholder: {
    width: 80,
  },
  search: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.inputRadius,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontFamily: theme.typography.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  list: {
    flex: 1,
  },
  loadingText: {
    fontFamily: theme.typography.medium,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    fontFamily: theme.typography.medium,
    fontSize: 13,
    color: theme.colors.danger,
    marginBottom: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.cardRadius,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  title: {
    fontFamily: theme.typography.semibold,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  meta: {
    fontFamily: theme.typography.medium,
    color: theme.colors.textSecondary,
    marginVertical: theme.spacing.xs,
  },
  instructions: {
    fontFamily: theme.typography.regular,
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  empty: {
    textAlign: 'center',
    fontFamily: theme.typography.medium,
    color: theme.colors.textSecondary,
  },
});


