// Food categories for organizing pantry items
export const foodCategories = [
  { id: 'fruits', name: 'Fruits', emoji: '🍎' },
  { id: 'vegetables', name: 'Vegetables', emoji: '🥕' },
  { id: 'dairy', name: 'Dairy', emoji: '🥛' },
  { id: 'meat', name: 'Meat & Seafood', emoji: '🍗' },
  { id: 'grains', name: 'Grains & Bread', emoji: '🍞' },
  { id: 'snacks', name: 'Snacks', emoji: '🍪' },
  { id: 'beverages', name: 'Beverages', emoji: '🥤' },
  { id: 'frozen', name: 'Frozen', emoji: '🧊' },
  { id: 'condiments', name: 'Condiments', emoji: '🧂' },
  { id: 'other', name: 'Other', emoji: '📦' },
];

export const getCategoryById = (id) => {
  return foodCategories.find(cat => cat.id === id) || foodCategories[foodCategories.length - 1];
};

export const getCategoryName = (id) => {
  const category = getCategoryById(id);
  return category ? category.name : 'Other';
};


