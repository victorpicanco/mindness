export interface CreateThemeCategoryInput {
  readonly slug: string
  readonly name: string
}

export interface CreateThemeCategoryOutput {
  readonly categoryId: string
  readonly slug: string
  readonly name: string
}
