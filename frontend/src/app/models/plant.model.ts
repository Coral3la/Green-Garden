export interface Plant {
  id: string;
  name: string;
  imgUrl: string;
  location: string;
  wateringFrequencyDays: number;
  lastWateredAt: Date;
}
