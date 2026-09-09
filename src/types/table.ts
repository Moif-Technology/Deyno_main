export type TableStatus = 'available' | 'occupied' | 'reserved'

export interface RestaurantTable {
  id: string
  label: string
  seats: number
  status: TableStatus
}
