import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import { VoiceConsent } from '@/modules/accounts/domain/value-objects/voice-consent/index.js'
import type { AccountRow } from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'

export class AccountMapper {
  toDomain(row: AccountRow): Account {
    return Account.reconstitute({
      id: row.id,
      email: EmailAddress.create(row.email),
      authUserId: row.authUserId,
      timeZone: TimeZone.create(row.timeZone),
      plan: row.plan,
      status: row.status,
      voiceConsent:
        row.consentPurpose === 'voice_recording_and_analysis' &&
        row.consentVersion !== null &&
        row.consentAcceptedAt !== null
          ? VoiceConsent.create({
              version: row.consentVersion,
              acceptedAt: row.consentAcceptedAt,
            })
          : null,
      currentSessionId: row.currentSessionId,
      createdAt: row.createdAt,
    })
  }

  toPersistence(account: Account): AccountRow {
    return {
      id: account.id,
      email: account.email.value,
      authUserId: account.authUserId,
      timeZone: account.timeZone.value,
      plan: account.plan,
      status: account.status,
      consentPurpose: account.voiceConsent?.purpose ?? null,
      consentVersion: account.voiceConsent?.version ?? null,
      consentAcceptedAt: account.voiceConsent?.acceptedAt ?? null,
      currentSessionId: account.currentSessionId,
      createdAt: account.createdAt,
    }
  }
}
