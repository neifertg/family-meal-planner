// Seasonal produce data for North America
// Data based on typical peak seasons across various regions

export type SeasonalProduce = {
  month: number
  monthName: string
  fruits: string[]
  vegetables: string[]
}

export const seasonalProduceData: SeasonalProduce[] = [
  {
    month: 1,
    monthName: 'January',
    fruits: ['Grapefruit', 'Kiwi', 'Oranges', 'Tangerines', 'Lemons', 'Pears'],
    vegetables: ['Brussels Sprouts', 'Cabbage', 'Kale', 'Leeks', 'Sweet Potatoes', 'Winter Squash', 'Turnips']
  },
  {
    month: 2,
    monthName: 'February',
    fruits: ['Grapefruit', 'Kiwi', 'Oranges', 'Tangerines', 'Lemons', 'Pears'],
    vegetables: ['Brussels Sprouts', 'Cabbage', 'Cauliflower', 'Kale', 'Leeks', 'Sweet Potatoes', 'Winter Squash']
  },
  {
    month: 3,
    monthName: 'March',
    fruits: ['Grapefruit', 'Kiwi', 'Lemons', 'Oranges', 'Pineapple', 'Strawberries'],
    vegetables: ['Artichokes', 'Asparagus', 'Broccoli', 'Cabbage', 'Cauliflower', 'Lettuce', 'Mushrooms', 'Spinach']
  },
  {
    month: 4,
    monthName: 'April',
    fruits: ['Lemons', 'Limes', 'Pineapple', 'Strawberries', 'Mangoes'],
    vegetables: ['Artichokes', 'Asparagus', 'Broccoli', 'Lettuce', 'Peas', 'Radishes', 'Rhubarb', 'Spinach']
  },
  {
    month: 5,
    monthName: 'May',
    fruits: ['Apricots', 'Cherries', 'Strawberries', 'Pineapple', 'Mangoes'],
    vegetables: ['Artichokes', 'Asparagus', 'Lettuce', 'Peas', 'Radishes', 'Rhubarb', 'Spinach', 'Zucchini']
  },
  {
    month: 6,
    monthName: 'June',
    fruits: ['Blueberries', 'Cherries', 'Peaches', 'Strawberries', 'Watermelon', 'Cantaloupe'],
    vegetables: ['Beets', 'Bell Peppers', 'Cucumbers', 'Green Beans', 'Lettuce', 'Tomatoes', 'Zucchini', 'Summer Squash']
  },
  {
    month: 7,
    monthName: 'July',
    fruits: ['Blackberries', 'Blueberries', 'Peaches', 'Plums', 'Raspberries', 'Watermelon', 'Cantaloupe'],
    vegetables: ['Bell Peppers', 'Corn', 'Cucumbers', 'Eggplant', 'Green Beans', 'Tomatoes', 'Zucchini', 'Summer Squash']
  },
  {
    month: 8,
    monthName: 'August',
    fruits: ['Apples', 'Blackberries', 'Figs', 'Grapes', 'Nectarines', 'Peaches', 'Plums', 'Watermelon'],
    vegetables: ['Bell Peppers', 'Corn', 'Cucumbers', 'Eggplant', 'Green Beans', 'Tomatoes', 'Zucchini', 'Okra']
  },
  {
    month: 9,
    monthName: 'September',
    fruits: ['Apples', 'Figs', 'Grapes', 'Pears', 'Pomegranates'],
    vegetables: ['Broccoli', 'Brussels Sprouts', 'Cauliflower', 'Eggplant', 'Pumpkin', 'Sweet Potatoes', 'Winter Squash']
  },
  {
    month: 10,
    monthName: 'October',
    fruits: ['Apples', 'Cranberries', 'Grapes', 'Pears', 'Pomegranates'],
    vegetables: ['Broccoli', 'Brussels Sprouts', 'Cabbage', 'Cauliflower', 'Kale', 'Pumpkin', 'Sweet Potatoes', 'Winter Squash']
  },
  {
    month: 11,
    monthName: 'November',
    fruits: ['Apples', 'Cranberries', 'Pears', 'Persimmons', 'Pomegranates', 'Tangerines'],
    vegetables: ['Brussels Sprouts', 'Cabbage', 'Cauliflower', 'Kale', 'Sweet Potatoes', 'Winter Squash', 'Turnips']
  },
  {
    month: 12,
    monthName: 'December',
    fruits: ['Grapefruit', 'Kiwi', 'Oranges', 'Pears', 'Persimmons', 'Tangerines'],
    vegetables: ['Brussels Sprouts', 'Cabbage', 'Kale', 'Leeks', 'Sweet Potatoes', 'Winter Squash', 'Turnips']
  }
]

export function getCurrentSeasonalProduce(): SeasonalProduce {
  const currentMonth = new Date().getMonth() + 1 // JavaScript months are 0-indexed
  return seasonalProduceData[currentMonth - 1]
}

export function getSeasonalProduceForMonth(month: number): SeasonalProduce {
  return seasonalProduceData[month - 1]
}
