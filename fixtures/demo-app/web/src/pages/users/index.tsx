import { listUsers } from '../../api/users';

export default function UserListPage() {
  const users = listUsers();
  return <ul>{users.map((u) => <li key={u.id}>{u.email}</li>)}</ul>;
}
