import { IconDiscount2, IconSparkles, IconTag } from '@tabler/icons-react'
import type { LabelKind } from '../api/dictionariesApi'

export const LABEL_ICONS = { sale: IconDiscount2, new: IconSparkles, manual: IconTag } satisfies Record<LabelKind, typeof IconTag>
