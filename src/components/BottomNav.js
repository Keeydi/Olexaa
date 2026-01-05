import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme';

const iconMap = {
  Home: 'home',
  Add: 'plus-circle',
  Stats: 'bar-chart-2',
  Recipes: 'book-open',
};

export function BottomNav({ tabs, activeTab, onChange }) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onChange(tab)}
            style={styles.item}
            accessibilityRole="button"
          >
            <Feather
              name={iconMap[tab] ?? 'circle'}
              size={22}
              color={isActive ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.label,
                {
                  color: isActive
                    ? theme.colors.primary
                    : theme.colors.textSecondary,
                  fontFamily: isActive
                    ? theme.typography.semibold
                    : theme.typography.medium,
                },
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderRadius: 24,
    ...theme.shadow.card,
  },
  item: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    flex: 1,
  },
  label: {
    fontSize: 12,
  },
});


