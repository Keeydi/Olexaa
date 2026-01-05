import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

export function SectionHeader({ title, actionLabel, onPressAction }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel ? (
        <TouchableOpacity onPress={onPressAction} accessibilityRole="button">
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.typography.semibold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  action: {
    fontFamily: theme.typography.medium,
    color: theme.colors.primary,
  },
});


