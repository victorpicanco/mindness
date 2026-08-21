export interface ThemesPort {
  findTitle(themeId: string): Promise<string | null>
}
