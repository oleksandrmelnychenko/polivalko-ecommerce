import { Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconHourglassHigh } from '@tabler/icons-react'
import { PageHeader } from './PageHeader'
import './page-state.css'

type PlaceholderPageProps = {
  title: string
  description?: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="page-state placeholder-page">
      <PageHeader title={title} />
      <Stack align="center" gap={6} maw={460} ta="center">
        <ThemeIcon variant="light" color="brand" size={56} radius="xl">
          <IconHourglassHigh size={26} stroke={1.6} />
        </ThemeIcon>
        <Title order={1} size="h3" fw={600} mt={6}>
          {title}
        </Title>
        <Text fw={600} c="brand.8">
          Розділ переноситься
        </Text>
        {description ? (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        ) : null}
      </Stack>
    </div>
  )
}
