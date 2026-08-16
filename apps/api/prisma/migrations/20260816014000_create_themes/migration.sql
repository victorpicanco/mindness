-- CreateEnum
CREATE TYPE "theme_difficulty" AS ENUM ('easy', 'balanced', 'hard');

-- CreateEnum
CREATE TYPE "theme_publication_status" AS ENUM ('draft', 'published', 'withdrawn');

-- CreateTable
CREATE TABLE "theme_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "theme_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "difficulty" "theme_difficulty" NOT NULL,
    "publication_status" "theme_publication_status" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "theme_categories_slug_key" ON "theme_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "themes_category_id_normalized_title_key" ON "themes"("category_id", "normalized_title");

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "theme_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
