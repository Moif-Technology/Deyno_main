import { PasswordInput } from '../../../../components/common/PasswordInput'
import { type PosCtx } from '../../main/usePosMain'

export function PasswordChangeBody({ ctx }: { ctx: PosCtx }) {
  const {
    ef, entryModal, savePassword, setEf,
  } = ctx
  return (
    <>
      {entryModal === 'passwordChange' ? (
        <>
          <div className="pd-form-row">
            <label>Login Name</label>
            <input value={ef('pcLogin')} onChange={(e) => setEf('pcLogin', e.target.value)} />
          </div>
          <div className="pd-form-row">
            <label>Password</label>
            <PasswordInput value={ef('pcPassword')} onChange={(v) => setEf('pcPassword', v)} autoComplete="current-password" />
          </div>
          <div className="pd-form-row">
            <label>New Password</label>
            <PasswordInput value={ef('pcNewPassword')} onChange={(v) => setEf('pcNewPassword', v)} autoComplete="new-password" />
          </div>
          <div className="pd-form-row">
            <label>Confirm Password</label>
            <PasswordInput
              value={ef('pcConfirmPassword')}
              onChange={(v) => setEf('pcConfirmPassword', v)}
              autoComplete="new-password"
              onEnter={savePassword}
            />
          </div>
        </>
      ) : null}
    </>
  )
}
