import {
  // Financial icons
  IndianRupee,           // ₹ for What's Left, Profit
  Wallet,                // Total Cash Balance, What You Own
  ReceiptText,           // Bills Due, Total Expenses
  HandCoins,             // Pending Collection, Money to Collect

  // Cash flow indicators
  ArrowUpRight,          // Cash IN
  ArrowDownRight,        // Cash OUT
  TrendingUp,            // Positive trends
  TrendingDown,          // Negative trends

  // Party/People icons
  UserRoundPlus,         // Pending Customer, Add Customer
  UserRoundMinus,        // Pending Vendor, Add Vendor
  Users,                 // Team, Multiple parties

  // Navigation icons
  Home,
  FileText,              // Entries
  Bell,
  User,
  Settings,

  // Action icons
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit,
  Trash2,
  X,
  Check,

  // Other financial
  CreditCard,
  Banknote,
  PiggyBank,
  Calculator,
  Building2,

  // Alert icons
  AlertTriangle,
  AlertCircle,
  Info,

  // Misc
  RefreshCw,
  Clock,
  Calendar,
  StickyNote,
  Edit2,
  Mail,
  Lock,
  LogOut,
  MapPin,
  ImageIcon,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Activity,
  UserPlus,
  CheckCheck,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'

/**
 * Donna Icon Mapping System
 * Premium monochromatic line-art icons for Indian financial dashboard
 * Using Indian Rupee (₹) for financial metrics
 */
export const DonnaIcons = {
  // PRIMARY FINANCIAL ICONS (Indian Rupee ₹)
  whatsLeft: IndianRupee,           // "What's left!" hero card
  profitLens: IndianRupee,          // Profit Lens sales/profit
  profit: IndianRupee,              // Total Profit card

  // CASH & BALANCE ICONS
  totalCashBalance: Wallet,         // Total cash balance
  whatYouOwn: Wallet,               // What You Own (Home)
  cashBalance: Wallet,              // Any cash balance display

  // EXPENSE & BILLS ICONS
  billsDue: ReceiptText,            // Pending Bills, Bills Due
  totalExpenses: ReceiptText,       // Total Expenses (Profit Lens)
  whatYouOwe: ReceiptText,          // What You Owe (Home)
  expenses: ReceiptText,            // Any expense display

  // COLLECTION ICONS
  pendingCollection: HandCoins,     // Pending Collections
  moneyToCollect: HandCoins,        // Money to Collect
  receivables: HandCoins,           // Accounts receivable

  // CASH FLOW INDICATORS
  cashIn: ArrowUpRight,             // Cash IN
  cashOut: ArrowDownRight,          // Cash OUT
  trendUp: TrendingUp,              // Positive trend
  trendDown: TrendingDown,          // Negative trend

  // PARTY ICONS
  pendingCustomer: UserRoundPlus,   // Customer pending
  customer: UserRoundPlus,          // Add customer
  pendingVendor: UserRoundMinus,    // Vendor pending
  vendor: UserRoundMinus,           // Add vendor
  parties: Users,                   // Multiple parties

  // NAVIGATION ICONS
  home: Home,
  entries: FileText,
  alerts: Bell,
  profile: User,
  settings: Settings,

  // ACTION ICONS
  add: Plus,
  search: Search,
  filter: Filter,
  download: Download,
  upload: Upload,
  edit: Edit,
  edit2: Edit2,
  delete: Trash2,
  close: X,
  check: Check,
  checkCircle: CheckCircle,
  checkDouble: CheckCheck,

  // ADDITIONAL FINANCIAL
  creditCard: CreditCard,
  banknote: Banknote,
  piggyBank: PiggyBank,
  calculator: Calculator,
  building: Building2,

  // ALERT ICONS
  alertTriangle: AlertTriangle,
  alertCircle: AlertCircle,
  info: Info,

  // UTILITY ICONS
  refresh: RefreshCw,
  clock: Clock,
  calendar: Calendar,
  note: StickyNote,
  mail: Mail,
  lock: Lock,
  logout: LogOut,
  location: MapPin,
  image: ImageIcon,
  phone: Phone,
  xCircle: XCircle,
  loader: Loader2,
  eye: Eye,
  eyeOff: EyeOff,
  copy: Copy,
  activity: Activity,
  userPlus: UserPlus,
} as const

export type DonnaIconName = keyof typeof DonnaIcons

/**
 * Get icon component by name
 * @param name - Icon name from DonnaIcons
 * @returns LucideIcon component
 */
export function getDonnaIcon(name: DonnaIconName): LucideIcon {
  return DonnaIcons[name]
}

/**
 * Helper to get financial icon with appropriate variant
 * @param type - Type of financial metric
 * @returns Icon and suggested variant
 */
export function getFinancialIcon(
  type: 'positive' | 'negative' | 'neutral' | 'balance'
): { icon: LucideIcon; variant: 'default' | 'success' | 'danger' } {
  switch (type) {
    case 'positive':
      return { icon: IndianRupee, variant: 'success' }
    case 'negative':
      return { icon: ReceiptText, variant: 'danger' }
    case 'balance':
      return { icon: Wallet, variant: 'default' }
    default:
      return { icon: IndianRupee, variant: 'default' }
  }
}
