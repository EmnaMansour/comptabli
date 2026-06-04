export interface NetworkingComptable {
  id: number;
  name: string;
  title: string;
  description: string;
  location: string;
  experienceYears: number;
  rating: number;
  reviewCount: number;
  avatar: string;
  avatarBg: string;
  tags: string[];
  featured?: boolean;
  bookmarked?: boolean;
  variant: 'navy' | 'teal';
  phone: string;
  email: string;
  address: string;
  specialties: string[];
}

export const NETWORKING_COMPTABLES: NetworkingComptable[] = [
  {
    id: 1,
    name: 'Cabinet chevaille',
    title: 'Expert comptable',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    location: 'Jardins de Carthage',
    experienceYears: 12,
    rating: 4.9,
    reviewCount: 127,
    avatar: 'CC',
    avatarBg: '#1e3a5f',
    tags: ['Corporate Tax', 'Tax Planning', 'International Tax'],
    bookmarked: true,
    variant: 'navy',
    phone: '+216 00 000 000',
    email: 'Cabinetchevi@gmail.com',
    address: '12 Habib Bourguiba, le Bardo',
    specialties: ['Artificial Intelligence', 'DATA', 'Engineering', 'Professional Services', 'Engineering', 'Professional Services'],
  },
  {
    id: 2,
    name: 'Cabinet chevaille',
    title: 'Expert comptable',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco.',
    location: 'Jardins de Carthage',
    experienceYears: 12,
    rating: 4.9,
    reviewCount: 127,
    avatar: 'CC',
    avatarBg: '#1e3a5f',
    tags: ['Corporate Tax', 'Tax Planning', 'International Tax'],
    featured: true,
    variant: 'navy',
    phone: '+216 00 000 000',
    email: 'Cabinetchevi@gmail.com',
    address: '12 Habib Bourguiba, le Bardo',
    specialties: ['Artificial Intelligence', 'Engineering', 'Professional Services'],
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: i + 3,
    name: i % 2 === 0 ? 'Cabinet chevaille' : 'Expertise Plus',
    title: 'Expert comptable',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    location: i % 2 === 0 ? 'Le Bardo, Tunis' : 'La Marsa, Tunis',
    experienceYears: 8 + i,
    rating: 4.4 + (i % 5) * 0.1,
    reviewCount: 20 + i * 15,
    avatar: i % 2 === 0 ? 'CC' : 'EP',
    avatarBg: i % 2 === 0 ? '#1e3a5f' : '#0d9488',
    tags: ['Corporate Tax', 'Tax Planning', 'International Tax'],
    variant: (i % 2 === 0 ? 'navy' : 'teal') as 'navy' | 'teal',
    phone: '+216 71 000 00' + i,
    email: `contact${i}@cabinet.tn`,
    address: `${10 + i} Av. Habib Bourguiba, Tunis`,
    specialties: ['Finance', 'Audit', 'Conseil'],
  })),
];

export function getComptableById(id: string): NetworkingComptable | undefined {
  const n = parseInt(id, 10);
  return NETWORKING_COMPTABLES.find((c) => c.id === n);
}
