import { useUser } from '../../hooks/useUser';

export default function UserPage({ id }: { id: string }) {
  const user = useUser(id);
  return <main>{user.email} — {user.displayName}</main>;
}
