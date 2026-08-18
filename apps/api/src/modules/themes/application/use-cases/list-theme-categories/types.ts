export type ListThemeCategoriesInput = null

export interface ThemeCategoryListItem {
  readonly categoryId: string
  readonly slug: string
  readonly name: string
}

export type ListThemeCategoriesOutput = readonly ThemeCategoryListItem[]
