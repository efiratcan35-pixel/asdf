import { redirect } from 'next/navigation';

export default function NewInvestorProjectPage() {
  redirect('/dashboard/investor/projects?new=1');
}
