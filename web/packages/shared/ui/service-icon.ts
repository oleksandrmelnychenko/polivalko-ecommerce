import {
  IconCut, IconDroplet, IconLawnMower, IconMap2, IconSeeding, IconSpray, IconTool, IconTrees, type Icon,
} from '@tabler/icons-react'

export { IconSeeding as GardenServicesIcon }

const symbols = new Map<string, Icon>([
  ['landscape-design', IconMap2],
  ['irrigation-installation', IconDroplet],
  ['greening', IconTrees],
  ['lawns', IconLawnMower],
  ['garden-care', IconCut],
  ['irrigation-service', IconTool],
  ['plant-treatment', IconSpray],
])

export function serviceIcon(code: string): Icon {
  return symbols.get(code) ?? IconSeeding
}
