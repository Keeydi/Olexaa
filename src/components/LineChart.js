import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { theme } from '../theme';

export function LineChart({ data }) {
  if (!data?.length) {
    return null;
  }

  const width = 280;
  const height = 120;
  const maxValue = Math.max(...data.map((point) => point.value));
  const minValue = Math.min(...data.map((point) => point.value));
  const verticalRange = maxValue - minValue || 1;
  const stepX = width / (data.length - 1 || 1);

  const path = data
    .map((point, index) => {
      const x = index * stepX;
      const y =
        height - ((point.value - minValue) / verticalRange) * (height - 10);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        <Path d={path} stroke={theme.colors.primary} strokeWidth={4} fill="none" />
        {data.map((point, index) => {
          const x = index * stepX;
          const y =
            height - ((point.value - minValue) / verticalRange) * (height - 10);
          return (
            <Circle
              key={point.label}
              cx={x}
              cy={y}
              r={6}
              fill={theme.colors.card}
              stroke={theme.colors.primary}
              strokeWidth={3}
            />
          );
        })}
      </Svg>
      <View style={styles.labels}>
        {data.map((point) => (
          <Text key={point.label} style={styles.label}>
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  label: {
    fontFamily: theme.typography.medium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});


