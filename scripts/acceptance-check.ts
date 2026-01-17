/**
 * Acceptance Check - Validates sprint completion criteria
 *
 * Usage: npx tsx scripts/acceptance-check.ts <sprint-number>
 */

import { existsSync, readdirSync } from 'fs'
import { spawnSync } from 'child_process'

interface SprintCriteria {
  name: string
  checks: Check[]
}

interface Check {
  name: string
  test: () => boolean
  required: boolean
}

function fileExists(path: string): boolean {
  return existsSync(path)
}

function hasTestFiles(dir: string): boolean {
  try {
    const files = readdirSync(dir, { recursive: true }) as string[]
    return files.some(f => f.endsWith('.test.ts'))
  } catch {
    return false
  }
}

function runCommand(cmd: string, args: string[]): boolean {
  const result = spawnSync(cmd, args, { stdio: 'pipe' })
  return result.status === 0
}

const sprintCriteria: Record<number, SprintCriteria> = {
  0: {
    name: 'Sprint 0: Automated Acceptance Infrastructure',
    checks: [
      {
        name: 'Vitest workspace configured',
        test: () => fileExists('vitest.workspace.ts'),
        required: true,
      },
      {
        name: 'Docker test compose exists',
        test: () => fileExists('docker-compose.test.yml'),
        required: true,
      },
      {
        name: 'API vitest config exists',
        test: () => fileExists('apps/api/vitest.config.ts'),
        required: true,
      },
      {
        name: 'API tests exist',
        test: () => hasTestFiles('apps/api/src'),
        required: true,
      },
      {
        name: 'pnpm build passes',
        test: () => runCommand('pnpm', ['build']),
        required: true,
      },
      {
        name: 'pnpm test passes',
        test: () => runCommand('pnpm', ['test']),
        required: true,
      },
    ],
  },
  1: {
    name: 'Sprint 1: Web Frontend Foundation',
    checks: [
      {
        name: 'Web app exists',
        test: () => fileExists('apps/web/package.json'),
        required: true,
      },
      {
        name: 'Login page exists',
        test: () => fileExists('apps/web/src/pages/Login.tsx'),
        required: true,
      },
      {
        name: 'Register page exists',
        test: () => fileExists('apps/web/src/pages/Register.tsx'),
        required: true,
      },
      {
        name: 'Dashboard page exists',
        test: () => fileExists('apps/web/src/pages/Dashboard.tsx'),
        required: true,
      },
      {
        name: 'Agents page exists',
        test: () => fileExists('apps/web/src/pages/Agents.tsx'),
        required: true,
      },
      {
        name: 'Tasks page exists',
        test: () => fileExists('apps/web/src/pages/Tasks.tsx'),
        required: true,
      },
      {
        name: 'TaskRun page exists',
        test: () => fileExists('apps/web/src/pages/TaskRun.tsx'),
        required: true,
      },
      {
        name: 'E2E tests exist',
        test: () => fileExists('apps/web/e2e'),
        required: true,
      },
      {
        name: 'pnpm build passes',
        test: () => runCommand('pnpm', ['build']),
        required: true,
      },
    ],
  },
  2: {
    name: 'Sprint 2: Payments (Stripe)',
    checks: [
      {
        name: 'Stripe service exists',
        test: () => fileExists('apps/api/src/services/stripe.service.ts'),
        required: true,
      },
      {
        name: 'Stripe webhook route exists',
        test: () => fileExists('apps/api/src/routes/stripe-webhook/index.ts'),
        required: true,
      },
      {
        name: 'Billing page exists',
        test: () => fileExists('apps/web/src/pages/Billing.tsx'),
        required: true,
      },
    ],
  },
  3: {
    name: 'Sprint 3: Storage & Tools',
    checks: [
      {
        name: 'S3 service exists',
        test: () => fileExists('apps/api/src/services/s3.service.ts'),
        required: true,
      },
      {
        name: 'Artifact repository exists',
        test: () => fileExists('apps/api/src/repositories/pg-artifact.repository.ts'),
        required: true,
      },
      {
        name: 'Tools route exists',
        test: () => fileExists('apps/api/src/routes/tools/index.ts'),
        required: true,
      },
      {
        name: 'Custom HTTP tool exists',
        test: () => fileExists('apps/worker/src/tools/custom/http.ts'),
        required: true,
      },
    ],
  },
  4: {
    name: 'Sprint 4: OAuth',
    checks: [
      {
        name: 'OAuth service exists',
        test: () => fileExists('apps/api/src/services/oauth.service.ts'),
        required: true,
      },
    ],
  },
}

function runAcceptanceCheck(sprintNumber: number) {
  const criteria = sprintCriteria[sprintNumber]

  if (!criteria) {
    console.error(`Unknown sprint: ${sprintNumber}`)
    console.log('Available sprints: 0, 1, 2, 3, 4')
    process.exit(1)
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  ${criteria.name}`)
  console.log(`${'='.repeat(50)}\n`)

  let passed = 0
  let failed = 0

  for (const check of criteria.checks) {
    process.stdout.write(`  Checking: ${check.name}... `)
    const result = check.test()
    const status = result ? '\u2705' : (check.required ? '\u274C' : '\u26A0\uFE0F')
    console.log(status)

    if (result) {
      passed++
    } else {
      failed++
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  console.log(`${'='.repeat(50)}\n`)

  if (failed > 0) {
    console.log('\u274C Sprint acceptance criteria NOT met')
    process.exit(1)
  } else {
    console.log('\u2705 Sprint acceptance criteria MET - Ready for next sprint!')
    process.exit(0)
  }
}

// Main
const sprintArg = process.argv[2]
if (!sprintArg) {
  console.log('Usage: npx tsx scripts/acceptance-check.ts <sprint-number>')
  console.log('Available sprints: 0, 1, 2, 3, 4')
  process.exit(1)
}

runAcceptanceCheck(parseInt(sprintArg, 10))
