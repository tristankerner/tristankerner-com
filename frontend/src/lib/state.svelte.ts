export const themeState = $state({
  darkMode: false,
});

export interface PageVisitorCount {
  path: string;
  total_unique_visitors: number;
}

export const counterState = $state({
  loading: true,
  completedOnce: false,
  error: false,
  errorMessage: null as string | null,
  pageCounts: [
      { 'path': '/',  'total_unique_visitors': 0 }
  ] as PageVisitorCount[],
});
