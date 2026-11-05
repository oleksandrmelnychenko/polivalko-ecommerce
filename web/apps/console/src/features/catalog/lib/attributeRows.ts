import type { ProductAttribute } from '../api/catalogApi'

export type AttributeRow = ProductAttribute & { key: number }

let nextKey = 1

export function attributeRows(list: ProductAttribute[]): AttributeRow[] {
  return list.map((attribute) => ({ ...attribute, key: nextKey++ }))
}

export function newAttributeRow(): AttributeRow {
  return { name: '', value: '', key: nextKey++ }
}
