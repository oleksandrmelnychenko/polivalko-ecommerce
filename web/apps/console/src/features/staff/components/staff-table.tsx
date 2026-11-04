import { roleLabel, roleOf, type StaffUser } from "../lib/roles";

export function StaffTable({
  users,
  email,
  busy,
  onEdit,
  onPassword,
  onLock,
}: {
  users: StaffUser[];
  email: string;
  busy: string | null;
  onEdit: (user: StaffUser) => void;
  onPassword: (user: StaffUser) => void;
  onLock: (user: StaffUser) => void;
}) {
  return (
    <div className="console-table-wrap">
      <table className="console-table">
        <thead>
          <tr>
            <th scope="col">Працівник</th>
            <th scope="col">Роль</th>
            <th scope="col">Доступ</th>
            <th scope="col" className="col-actions">
              <span className="visually-hidden">Дії</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const self = u.email.toLowerCase() === email.toLowerCase();
            return (
              <tr key={u.id}>
                <td>
                  <span className="cell-strong">
                    {u.displayName}
                    {self && <span className="muted"> (ви)</span>}
                  </span>
                  <span className="cell-sub">{u.email}</span>
                </td>
                <td>
                  <span className={roleOf(u) === "Admin" ? "chip chip--dark" : "chip chip--grey"}>{roleLabel[roleOf(u)]}</span>
                </td>
                <td>{u.lockedOut ? <span className="chip chip--pink">Заблоковано</span> : <span className="chip chip--green">Активний</span>}</td>
                <td className="col-actions">
                  <div className="console-actions console-actions--row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                    <button type="button" className="btn btn--small btn--quiet" onClick={() => onEdit(u)}>
                      Змінити
                    </button>
                    <button type="button" className="btn btn--small btn--quiet" onClick={() => onPassword(u)}>
                      Новий пароль
                    </button>
                    <button
                      type="button"
                      className={u.lockedOut ? "btn btn--small btn--quiet" : "btn btn--small btn--danger"}
                      disabled={busy !== null}
                      aria-busy={busy === u.id}
                      onClick={() => onLock(u)}
                    >
                      {u.lockedOut ? "Розблокувати" : "Заблокувати"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
