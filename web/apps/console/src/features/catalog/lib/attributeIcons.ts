import {
  IconAngle, IconArrowsHorizontal, IconBarcode, IconBolt, IconBox, IconBoxModel, IconBuildingFactory2,
  IconCategory, IconCircle, IconCloudRain, IconDimensions, IconDroplets, IconFingerprint, IconGauge,
  IconLayersIntersect, IconList, IconNumber123, IconNut, IconPalette, IconPaperclip, IconPlugConnected,
  IconRadiusTopLeft, IconRulerMeasure, IconShape, IconTag, IconTemperature, IconToggleRight,
  IconWaveSine, IconWeight, type Icon,
} from '@tabler/icons-react'
import type { AttributeDefinition } from '../api/dictionariesApi'

const symbols: [RegExp, Icon][] = [
  [/штрих|barcode/iu, IconBarcode],
  [/артикул.*виробник/iu, IconFingerprint],
  [/артикул|sku/iu, IconTag],
  [/категорі/iu, IconCategory],
  [/одиниц.*вимір/iu, IconRulerMeasure],
  [/фасув|пакув/iu, IconBox],
  [/форма.*потоку/iu, IconWaveSine],
  [/форм[аи]/iu, IconShape],
  [/модель/iu, IconBoxModel],
  [/виробник/iu, IconBuildingFactory2],
  [/сектор|кут/iu, IconAngle],
  [/радіус/iu, IconRadiusTopLeft],
  [/діаметр/iu, IconCircle],
  [/інтенсивн|витрат.*вод/iu, IconDroplets],
  [/тиск/iu, IconGauge],
  [/різь/iu, IconNut],
  [/колір|кольор/iu, IconPalette],
  [/з[’'ʼ]?єдн|підключ/iu, IconPlugConnected],
  [/опад/iu, IconCloudRain],
  [/довжин|ширин|висот/iu, IconArrowsHorizontal],
  [/кріплен/iu, IconPaperclip],
  [/матеріал/iu, IconLayersIntersect],
  [/розмір/iu, IconDimensions],
  [/температур/iu, IconTemperature],
  [/вага|маса/iu, IconWeight],
  [/потужніст|напруг/iu, IconBolt],
  [/^тип$/iu, IconCategory],
]

const kindIcons = { list: IconList, number: IconNumber123, boolean: IconToggleRight }

export function attributeIcon({ name, kind }: Pick<AttributeDefinition, 'name' | 'kind'>): Icon {
  const title = name.trim()
  return symbols.find(([pattern]) => pattern.test(title))?.[1] ?? kindIcons[kind] ?? IconList
}
