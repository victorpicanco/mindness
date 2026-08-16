import type {
  Theme,
  ThemeCategory,
  ThemeDifficulty,
  ThemePublicationStatus,
} from '@/generated/prisma/client.js'

export type ThemeRow = Theme
export type ThemeCategoryRow = ThemeCategory

export interface ThemeUpsertArgs {
  readonly where: { readonly id: string }
  readonly create: ThemeRow
  readonly update: ThemeRow
}

export interface ThemeCategoryUpsertArgs {
  readonly where: { readonly id: string }
  readonly create: ThemeCategoryRow
  readonly update: ThemeCategoryRow
}

export interface ThemeCombinationRow {
  readonly categoryId: string
  readonly difficulty: ThemeDifficulty
}

export interface ThemesPrismaClient {
  readonly theme: {
    findUnique(args: { readonly where: { readonly id: string } }): Promise<ThemeRow | null>
    findFirst(args: {
      readonly where: { readonly categoryId: string; readonly normalizedTitle: string }
    }): Promise<ThemeRow | null>
    upsert(args: ThemeUpsertArgs): Promise<ThemeRow>
    count(args: {
      readonly where: {
        readonly categoryId: string
        readonly difficulty: ThemeDifficulty
        readonly publicationStatus: ThemePublicationStatus
      }
    }): Promise<number>
    findMany(args: {
      readonly where: { readonly publicationStatus: ThemePublicationStatus }
      readonly distinct: ['categoryId', 'difficulty']
      readonly select: { readonly categoryId: true; readonly difficulty: true }
    }): Promise<ThemeCombinationRow[]>
  }
  readonly themeCategory: {
    findUnique(args: {
      readonly where: { readonly id: string } | { readonly slug: string }
    }): Promise<ThemeCategoryRow | null>
    upsert(args: ThemeCategoryUpsertArgs): Promise<ThemeCategoryRow>
    findMany(args: {
      readonly where: {
        readonly themes: { readonly some: { readonly publicationStatus: ThemePublicationStatus } }
      }
    }): Promise<ThemeCategoryRow[]>
  }
  $queryRaw(query: TemplateStringsArray, ...values: readonly unknown[]): Promise<unknown>
}

export interface ThemesTransactionOptions {
  readonly isolationLevel: 'Serializable'
}

export interface ThemesPrismaTransactionRunner {
  $transaction<T>(
    operation: (transaction: ThemesPrismaClient) => Promise<T>,
    options: ThemesTransactionOptions,
  ): Promise<T>
}
