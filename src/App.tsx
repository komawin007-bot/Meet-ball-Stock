import React, { useState, useEffect, useMemo } from 'react';
import { domToPng } from 'modern-screenshot';
import { 
  LayoutDashboard, 
  PackagePlus, 
  ShoppingCart, 
  History, 
  BarChart3, 
  Plus, 
  Minus,
  AlertCircle,
  Search,
  Printer,
  CheckCircle2,
  Clock,
  Truck,
  Trash2,
  ChevronRight,
  Menu,
  X,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getThaiTime = (date?: string | Date) => {
  const now = date ? new Date(typeof date === 'string' && !date.includes('T') && !date.includes('Z') ? date.replace(' ', 'T') + 'Z' : date) : new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 7));
};

// --- Types ---
interface SubCategory {
  id: number;
  category_id: number;
  name: string;
  stock_quantity: number;
  unit?: string;
}

interface Category {
  id: number;
  name: string;
  color?: string;
  subCategories: SubCategory[];
}

interface Customer {
  id: number;
  name: string;
  address: string;
}

interface OrderItem {
  id: number;
  order_id: number;
  sub_category_id: number;
  product_name: string;
  quantity: number;
  price_per_unit: number;
}

interface Order {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_address: string;
  total_price: number;
  payment_status: string;
  shipping_status: string;
  created_at: string;
  items: OrderItem[];
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full px-4 py-3 text-sm font-medium transition-colors rounded-lg mb-1",
      active 
        ? "bg-emerald-50 text-emerald-700" 
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    )}
  >
    <Icon className={cn("w-5 h-5 mr-3", active ? "text-emerald-600" : "text-slate-400")} />
    {label}
  </button>
);

const Card = ({ children, className }: any) => (
  <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm", className)}>
    {children}
  </div>
);

// --- Pages ---

const Dashboard = ({ inventory, onRefresh, isRefreshing }: { inventory: Category[], onRefresh: () => void, isRefreshing: boolean }) => {
  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">ดูสต็อกสินค้า Real-time</p>
        </div>
        <button 
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4 text-emerald-600", isRefreshing && "animate-spin")} />
          {isRefreshing ? 'กำลังโหลด...' : 'อัปเดตสต็อกล่าสุด'}
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inventory.length === 0 && !isRefreshing && (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
            <p className="text-slate-500 font-medium">ไม่พบข้อมูลสินค้าใน Google Sheets</p>
          </div>
        )}
        {inventory.map((cat) => (
          <Card key={cat.id} className="flex flex-col border-none shadow-md overflow-hidden">
            <div 
              className="px-4 py-3 flex justify-between items-center text-white"
              style={{ backgroundColor: cat.color || '#64748b' }}
            >
              <h3 className="font-bold text-lg">{cat.name}</h3>
              <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                {(cat.subCategories || []).length} รายการ
              </span>
            </div>
            <div className="p-4 flex-1 bg-white">
              <div className="space-y-4">
                {(cat.subCategories || []).map((sub: any) => (
                  <div key={sub.id} className="flex justify-between items-center">
                    <span className="text-slate-600">{sub.name}</span>
                    <div className="flex items-center">
                      <span className={cn(
                        "font-mono font-bold text-lg",
                        sub.stock_quantity < 50 ? "text-red-600" : "text-slate-900"
                      )}>
                        {sub.stock_quantity.toLocaleString()}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">{sub.unit || 'กก.'}</span>
                      {sub.stock_quantity < 50 && (
                        <AlertCircle className="w-4 h-4 text-red-500 ml-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const ProductionInput = ({ inventory, onRefresh }: { inventory: Category[], onRefresh: () => void }) => {
  const [batchValues, setBatchValues] = useState<Record<number, { production: string, wastage: string }>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newType, setNewType] = useState<'category' | 'subcategory'>('category');
  const [newName, setNewName] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleInputChange = (subId: number, field: 'production' | 'wastage', value: string) => {
    setBatchValues(prev => ({
      ...prev,
      [subId]: {
        ...(prev[subId] || { production: '', wastage: '' }),
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updates: any[] = [];
    
    Object.entries(batchValues).forEach(([subId, values]) => {
      const v = values as { production: string, wastage: string };
      if (v.production && parseFloat(v.production) > 0) {
        updates.push({ subCategoryId: parseInt(subId), type: 'production', quantity: v.production });
      }
      if (v.wastage && parseFloat(v.wastage) > 0) {
        updates.push({ subCategoryId: parseInt(subId), type: 'wastage', quantity: v.wastage });
      }
    });

    if (updates.length === 0) {
      alert("กรุณากรอกจำนวนอย่างน้อย 1 รายการ");
      return;
    }

    setIsSubmitting(true);
    try {
      await fetch('/api/stock/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      setBatchValues({});
      onRefresh();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update stock:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNew = async () => {
    if (!newName) return;
    
    if (newType === 'category') {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
    } else {
      if (!selectedCatId) return;
      await fetch('/api/sub-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: selectedCatId, name: newName })
      });
    }

    setNewName('');
    setIsAddingNew(false);
    onRefresh();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">บันทึกการผลิต & รับเข้า Stock</h1>
          <p className="text-slate-500">บันทึกยอดผลิตรายวัน หรือ ของเสีย (Wastage) แบบรายวัน</p>
        </div>
        <button 
          onClick={() => setIsAddingNew(true)}
          className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          <Plus className="w-4 h-4" /> เพิ่มสินค้าใหม่
        </button>
      </header>

      <Card className="overflow-hidden border-none shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-bold">สินค้า (Product)</th>
                  <th className="px-6 py-4 font-bold text-center w-40">ผลิต (Production)</th>
                  <th className="px-6 py-4 font-bold text-center w-40">ของเสีย (Wastage)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map(cat => (
                  <React.Fragment key={cat.id}>
                    <tr className="bg-slate-50/80">
                      <td colSpan={3} className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{cat.name}</span>
                        </div>
                      </td>
                    </tr>
                    {(cat.subCategories || []).map((sub: any) => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-700">{sub.name}</div>
                          <div className="text-[10px] text-slate-400">คงเหลือ: {sub.stock_quantity} {sub.unit || 'กก.'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <input 
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            value={batchValues[sub.id]?.production || ''}
                            onChange={(e) => handleInputChange(sub.id, 'production', e.target.value)}
                            className="w-full text-center rounded-lg border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 text-sm py-1.5"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input 
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            value={batchValues[sub.id]?.wastage || ''}
                            onChange={(e) => handleInputChange(sub.id, 'wastage', e.target.value)}
                            className="w-full text-center rounded-lg border-slate-200 focus:ring-red-500 focus:border-red-500 text-sm py-1.5"
                          />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button 
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2",
                showSuccess 
                  ? "bg-emerald-500 text-white shadow-emerald-100 scale-105" 
                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200",
                isSubmitting && "opacity-70 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <Clock className="w-5 h-5 animate-spin" />
              ) : showSuccess ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {isSubmitting ? "กำลังบันทึก..." : showSuccess ? "บันทึกสำเร็จ!" : "ยืนยันบันทึกทั้งหมด (Confirm All)"}
            </button>
          </div>
        </form>
      </Card>

      <AnimatePresence>
        {isAddingNew && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
            >
              <Card className="p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-xl text-slate-900">เพิ่มสินค้าใหม่</h3>
                  <button onClick={() => setIsAddingNew(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                      onClick={() => setNewType('category')}
                      className={cn(
                        "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                        newType === 'category' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      หมวดหมู่หลัก
                    </button>
                    <button
                      onClick={() => setNewType('subcategory')}
                      className={cn(
                        "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                        newType === 'subcategory' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      หมวดหมู่ย่อย
                    </button>
                  </div>

                  {newType === 'subcategory' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">ภายใต้หมวดหมู่หลัก</label>
                      <select 
                        value={selectedCatId}
                        onChange={(e) => setSelectedCatId(e.target.value)}
                        className="w-full rounded-xl border-slate-200 text-sm focus:ring-emerald-500"
                      >
                        <option value="">เลือกหมวดหมู่</option>
                        {inventory.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">ชื่อรายการ</label>
                    <input 
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={newType === 'category' ? "เช่น หมู, เนื้อ, ไก่" : "เช่น ลูกชิ้นหมูจิ๋ว, เอ็นหมูพิเศษ"}
                      className="w-full rounded-xl border-slate-200 focus:ring-emerald-500"
                    />
                  </div>

                  <button 
                    onClick={handleAddNew}
                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                  >
                    บันทึกรายการใหม่
                  </button>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BillPreview = ({ id, customer, items, total }: { id?: string, customer: Customer | null, items: any[], total: number }) => {
  const today = format(getThaiTime(), 'dd/MM/yyyy');
  
  return (
    <div 
      id={id}
      className="rounded-none p-8 font-serif w-[400px] min-h-[500px] mx-auto sticky top-6"
      style={{ 
        backgroundColor: '#ffffff', 
        border: '1px solid #e2e8f0', 
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        color: '#1e293b'
      }}
    >
      <div className="text-center pb-4 mb-6" style={{ borderBottom: '2px solid #0f172a' }}>
        <h2 className="text-xl font-black uppercase tracking-tighter italic" style={{ color: '#0f172a' }}>ลูกชิ้น BB</h2>
        <p className="text-[10px] uppercase tracking-widest" style={{ color: '#64748b' }}>Wholesale & Distribution</p>
      </div>

      <div className="flex justify-between text-[10px] mb-6">
        <div>
          <p className="font-bold uppercase mb-1" style={{ color: '#94a3b8' }}>Customer</p>
          <p className="font-bold" style={{ color: '#0f172a' }}>{customer?.name || '----------------'}</p>
          <p className="max-w-[150px] leading-tight" style={{ color: '#64748b' }}>{customer?.address || '----------------'}</p>
        </div>
        <div className="text-right">
          <p className="font-bold uppercase mb-1" style={{ color: '#94a3b8' }}>Date</p>
          <p className="font-bold" style={{ color: '#0f172a' }}>{today}</p>
          <p className="font-bold uppercase mt-2 mb-1" style={{ color: '#94a3b8' }}>Invoice</p>
          <p className="font-bold" style={{ color: '#0f172a' }}>#DRAFT</p>
        </div>
      </div>

      <table className="w-full text-[11px] mb-8 border-collapse" style={{ border: '1px solid #cbd5e1' }}>
        <thead>
          <tr className="uppercase" style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
            <th className="text-left px-2 py-2 font-bold" style={{ border: '1px solid #cbd5e1' }}>รายการสินค้า</th>
            <th className="text-center px-2 py-2 font-bold w-16" style={{ border: '1px solid #cbd5e1' }}>จำนวน</th>
            <th className="text-right px-2 py-2 font-bold w-24" style={{ border: '1px solid #cbd5e1' }}>รวมเงิน</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td className="px-2 py-2" style={{ border: '1px solid #cbd5e1' }}>
                <p className="font-bold" style={{ color: '#0f172a' }}>{item.name}</p>
                <p className="text-[9px]" style={{ color: '#94a3b8' }}>฿{item.pricePerUnit}/กก.</p>
              </td>
              <td className="px-2 py-2 text-center font-medium" style={{ border: '1px solid #cbd5e1', color: '#1e293b' }}>{item.quantity}</td>
              <td className="px-2 py-2 text-right font-bold" style={{ border: '1px solid #cbd5e1', color: '#1e293b' }}>฿{item.total.toLocaleString()}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={3} className="py-8 text-center italic" style={{ border: '1px solid #cbd5e1', color: '#cbd5e1' }}>ยังไม่มีรายการสินค้า</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="pt-4 space-y-2" style={{ borderTop: '2px solid #0f172a' }}>
        <div className="flex justify-between text-[10px]">
          <span className="uppercase font-bold" style={{ color: '#94a3b8' }}>Subtotal</span>
          <span className="font-bold" style={{ color: '#1e293b' }}>฿{total.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="uppercase font-bold" style={{ color: '#94a3b8' }}>Shipping</span>
          <span className="font-bold" style={{ color: '#1e293b' }}>฿0</span>
        </div>
        <div className="flex justify-between text-lg pt-2">
          <span className="font-black uppercase tracking-tighter italic" style={{ color: '#0f172a' }}>Total</span>
          <span className="font-black" style={{ color: '#059669' }}>฿{total.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-10 pt-6 text-center" style={{ borderTop: '1px dashed #e2e8f0' }}>
        <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>Thank you for your business</p>
        <div className="flex justify-center gap-1">
          {[...Array(5)].map((_, i) => <div key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: '#e2e8f0' }} />)}
        </div>
      </div>
    </div>
  );
};

const OrderDispatch = ({ inventory, onRefresh, editingOrder, setEditingOrder }: { 
  inventory: Category[], 
  onRefresh: () => void,
  editingOrder: Order | null,
  setEditingOrder: (order: Order | null) => void
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', address: '' });
  
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentCatId, setCurrentCatId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/customers').then(res => res.json()).then(setCustomers);
  }, []);

  useEffect(() => {
    if (editingOrder) {
      setSelectedCustomer({
        id: editingOrder.customer_id,
        name: editingOrder.customer_name,
        address: editingOrder.customer_address
      });
      setSearchCustomer(editingOrder.customer_name);
      setOrderItems(editingOrder.items.map(item => ({
        subCategoryId: item.sub_category_id,
        name: item.product_name,
        quantity: item.quantity,
        pricePerUnit: item.price_per_unit,
        total: item.quantity * item.price_per_unit
      })));
    }
  }, [editingOrder]);

  const filteredCustomers = useMemo(() => {
    if (selectedCustomer) return [];
    if (!searchCustomer) {
      return isSearchFocused ? customers : [];
    }
    return customers.filter(c => c.name.toLowerCase().includes(searchCustomer.toLowerCase()));
  }, [searchCustomer, customers, selectedCustomer, isSearchFocused]);
  const allSubCategories = useMemo(() => {
    return inventory.flatMap(cat => (cat.subCategories || []).map((sub: any) => ({ ...sub, categoryName: cat.name, categoryColor: cat.color })));
  }, [inventory]);

  const filteredSubCategories = useMemo(() => {
    let subs = currentCatId 
      ? (inventory.find(c => c.id.toString() === currentCatId)?.subCategories || []).map((s: any) => {
          const cat = inventory.find(c => c.id.toString() === currentCatId);
          return { ...s, categoryName: cat?.name, categoryColor: cat?.color };
        })
      : allSubCategories;
    
    if (searchTerm) {
      subs = subs.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return subs;
  }, [currentCatId, inventory, allSubCategories, searchTerm]);

  const addItem = (sub: any, qty: number, price: number) => {
    setOrderItems([...orderItems, {
      subCategoryId: sub.id,
      name: sub.name,
      quantity: qty,
      pricePerUnit: price,
      total: qty * price
    }]);
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const totalOrderPrice = orderItems.reduce((sum, item) => sum + item.total, 0);

  const handleSaveCustomer = async () => {
    if (!newCustomer.name) return;
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCustomer)
    });
    const data = await res.json();
    const saved = { ...newCustomer, id: data.id };
    setCustomers([...customers, saved]);
    setSelectedCustomer(saved);
    setSearchCustomer(saved.name);
    setIsAddingCustomer(false);
  };

  const submitOrder = async () => {
    if (!selectedCustomer || orderItems.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    let billImage = "";
    try {
      const element = document.getElementById('bill-to-capture');
      if (element) {
        // Use modern-screenshot which handles oklch colors better than html2canvas
        billImage = await domToPng(element, {
          scale: 2,
          backgroundColor: '#ffffff',
          width: 400,
        });
        
        if (!billImage || billImage === "data:,") {
          console.error("Captured image is empty");
        }
      } else {
        console.error("Element #bill-to-capture not found in DOM");
      }
    } catch (error) {
      console.error("modern-screenshot capture error:", error);
    }

    try {
      // If editing, delete the old order first to revert stock
      if (editingOrder) {
        await fetch(`/api/orders/${editingOrder.id}`, { method: 'DELETE' });
      }

      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          items: orderItems,
          totalPrice: totalOrderPrice,
          billImage: billImage.replace(/^data:image\/png;base64,/, '')
        })
      });

      setOrderItems([]);
      setSelectedCustomer(null);
      setSearchCustomer('');
      setEditingOrder(null);
      onRefresh();
      alert(editingOrder ? 'แก้ไขออเดอร์เรียบร้อยแล้ว' : 'บันทึกออเดอร์เรียบร้อยแล้ว');
    } catch (err) {
      console.error("Submit order error:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกออเดอร์");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">สั่งซื้อ & จัดส่ง (Order)</h1>
          <p className="text-slate-500">สร้างออเดอร์ขายและออกบิล</p>
        </div>
        {editingOrder && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-3">
            <div className="text-amber-800 text-sm font-bold">
              กำลังแก้ไขออเดอร์ #{editingOrder.id}
            </div>
            <button 
              onClick={() => {
                setEditingOrder(null);
                setOrderItems([]);
                setSelectedCustomer(null);
                setSearchCustomer('');
              }}
              className="text-xs bg-white border border-amber-200 text-amber-600 px-2 py-1 rounded hover:bg-amber-100 transition-colors font-bold"
            >
              ยกเลิก
            </button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hidden capture area - always rendered and visible to modern-screenshot but off-screen */}
        <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
          <BillPreview id="bill-to-capture" customer={selectedCustomer} items={orderItems} total={totalOrderPrice} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Customer Section */}
          <Card className="p-6 relative z-20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800">ข้อมูลลูกค้า (Customer)</h3>
              <button 
                onClick={() => setIsAddingCustomer(true)}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                + เพิ่มลูกค้ารายใหม่
              </button>
            </div>
            
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  value={searchCustomer}
                  onChange={(e) => { setSearchCustomer(e.target.value); setSelectedCustomer(null); }}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  placeholder="ค้นหาชื่อลูกค้า..."
                  className="w-full pl-10 rounded-lg border-slate-200"
                />
              </div>
              
              {filteredCustomers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c); setSearchCustomer(c.name); }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-50 text-sm"
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-slate-400 truncate">{c.address}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-600"><span className="font-medium">ที่อยู่ (Address):</span> {selectedCustomer.address}</p>
              </motion.div>
            )}

            {isAddingCustomer && (
              <div className="mt-4 p-4 border border-emerald-100 bg-emerald-50/30 rounded-lg space-y-3">
                <input 
                  type="text" 
                  placeholder="ชื่อลูกค้า (Customer Name)"
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                  className="w-full rounded-lg border-slate-200 text-sm"
                />
                <textarea 
                  placeholder="ที่อยู่ (Address)"
                  value={newCustomer.address}
                  onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                  className="w-full rounded-lg border-slate-200 text-sm"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveCustomer} className="flex-1 bg-emerald-600 text-white py-1.5 rounded-lg text-sm font-medium">บันทึก (Save)</button>
                  <button onClick={() => setIsAddingCustomer(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">ยกเลิก (Cancel)</button>
                </div>
              </div>
            )}
          </Card>

          {/* Product Section */}
          <Card className="p-6 bg-slate-50/50 border-none shadow-none">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                เลือกสินค้า (Select Products)
              </h3>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="ค้นหาสินค้า..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 rounded-full border-slate-200 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Category Chips */}
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              <button
                onClick={() => setCurrentCatId('')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all",
                  currentCatId === '' 
                    ? "bg-slate-900 text-white shadow-md" 
                    : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                )}
              >
                ทั้งหมด
              </button>
              {inventory.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCurrentCatId(cat.id.toString())}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2",
                    currentCatId === cat.id.toString()
                      ? "shadow-md text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                  )}
                  style={{ 
                    backgroundColor: currentCatId === cat.id.toString() ? cat.color : undefined,
                    borderColor: currentCatId === cat.id.toString() ? cat.color : undefined
                  }}
                >
                  <div className="w-2 h-2 rounded-full bg-white/50" />
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              {filteredSubCategories.map(sub => (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={sub.id}
                  onClick={() => addItem(sub, 1, 0)} // Default 1kg, 0 price (user can edit in table)
                  className="bg-white p-3 rounded-xl border border-slate-200 text-left hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div 
                    className="absolute top-0 left-0 w-1 h-full" 
                    style={{ backgroundColor: sub.categoryColor }}
                  />
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{sub.categoryName}</div>
                  <div className="font-bold text-slate-800 text-sm group-hover:text-emerald-600 transition-colors">{sub.name}</div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">สต็อก: {sub.stock_quantity} {sub.unit || 'กก.'}</span>
                    <Plus className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.button>
              ))}
            </div>

            {filteredSubCategories.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <p>ไม่พบสินค้าที่ค้นหา</p>
              </div>
            )}

            {/* Order Table */}
            <div className="mt-8 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-700">รายการที่เลือก ({orderItems.length})</h4>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold">สินค้า</th>
                    <th className="px-4 py-2 text-center font-bold">จำนวน</th>
                    <th className="px-4 py-2 text-center font-bold">ราคา/หน่วย</th>
                    <th className="px-4 py-2 text-right font-bold">รวม</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-700">{item.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => {
                              const newItems = [...orderItems];
                              newItems[idx].quantity = Math.max(0.5, newItems[idx].quantity - 0.5);
                              newItems[idx].total = newItems[idx].quantity * newItems[idx].pricePerUnit;
                              setOrderItems(newItems);
                            }}
                            className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input 
                            type="number"
                            value={item.quantity}
                            onChange={e => {
                              const newItems = [...orderItems];
                              newItems[idx].quantity = parseFloat(e.target.value) || 0;
                              newItems[idx].total = newItems[idx].quantity * newItems[idx].pricePerUnit;
                              setOrderItems(newItems);
                            }}
                            className="w-16 text-center border-none p-0 focus:ring-0 font-bold text-slate-700"
                          />
                          <button 
                            onClick={() => {
                              const newItems = [...orderItems];
                              newItems[idx].quantity += 0.5;
                              newItems[idx].total = newItems[idx].quantity * newItems[idx].pricePerUnit;
                              setOrderItems(newItems);
                            }}
                            className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex flex-wrap justify-center gap-1">
                            {[60, 55, 53, 50].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  const newItems = [...orderItems];
                                  newItems[idx].pricePerUnit = p;
                                  newItems[idx].total = newItems[idx].quantity * p;
                                  setOrderItems(newItems);
                                }}
                                className={cn(
                                  "w-8 h-6 flex items-center justify-center rounded text-[10px] font-bold border transition-all",
                                  item.pricePerUnit === p 
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                                    : "bg-white text-slate-500 border-slate-200 hover:border-emerald-500"
                                )}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                            <span className="text-slate-400 text-[10px]">฿</span>
                            <input 
                              type="number"
                              value={item.pricePerUnit}
                              onChange={e => {
                                const newItems = [...orderItems];
                                newItems[idx].pricePerUnit = parseFloat(e.target.value) || 0;
                                newItems[idx].total = newItems[idx].quantity * newItems[idx].pricePerUnit;
                                setOrderItems(newItems);
                              }}
                              placeholder="ระบุเอง"
                              className="w-12 text-center border-none bg-transparent p-0 focus:ring-0 text-xs font-bold text-emerald-600"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">
                        ฿{item.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {orderItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-300">
                          <ShoppingCart className="w-8 h-8 opacity-20" />
                          <p className="italic text-sm">ยังไม่ได้เลือกสินค้า</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              
              {orderItems.length > 0 && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                  <button 
                    onClick={() => setOrderItems([])}
                    className="px-4 py-2 text-slate-500 hover:text-red-500 text-sm font-medium transition-colors"
                  >
                    ล้างรายการ (Clear)
                  </button>
                  <button 
                    onClick={submitOrder}
                    disabled={!selectedCustomer || isSubmitting}
                    className="bg-emerald-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-emerald-500 transition-all shadow-md shadow-emerald-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        กำลังบันทึกและสร้างบิล...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        เสร็จสิ้น / ทำบิล (Finish)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-slate-900 text-white">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">สรุปยอดสั่งซื้อ (Summary)</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">ยอดรวมสินค้า</span>
                <span>฿{totalOrderPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">ภาษี (Tax 0%)</span>
                <span>฿0</span>
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-between items-end">
                <span className="text-slate-400 font-medium">ยอดรวมทั้งสิ้น</span>
                <span className="text-2xl font-bold text-emerald-400">฿{totalOrderPrice.toLocaleString()}</span>
              </div>
            </div>
            <button 
              onClick={submitOrder}
              disabled={!selectedCustomer || orderItems.length === 0}
              className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ยืนยัน & พิมพ์ (Print)
            </button>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 py-2 border border-slate-700 rounded-lg text-xs font-medium hover:bg-slate-800">
                <Printer className="w-3 h-3" /> พิมพ์บิล (Print)
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2 border border-slate-700 rounded-lg text-xs font-medium hover:bg-slate-800">
                แชร์ LINE
              </button>
            </div>
          </Card>

          <div className="hidden lg:block">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">ตัวอย่างบิล (Bill Preview)</h3>
            <BillPreview customer={selectedCustomer} items={orderItems} total={totalOrderPrice} />
          </div>
        </div>

        {/* Mobile Preview Button or Modal could go here, but let's stick to desktop for now as requested "โชว์ที่ตัวอย่างบิล" */}
        <div className="lg:hidden mt-8">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">ตัวอย่างบิล (Bill Preview)</h3>
          <BillPreview customer={selectedCustomer} items={orderItems} total={totalOrderPrice} />
        </div>
      </div>
    </div>
  );
};

const HistoryPage = ({ onEdit, onRefresh }: { onEdit: (order: Order) => void, onRefresh?: () => void }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [date, setDate] = useState(format(getThaiTime(), 'yyyy-MM-dd'));
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchOrders = async () => {
    const res = await fetch(`/api/orders?date=${date}`);
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : (data.items || []));
  };

  useEffect(() => {
    fetchOrders();
  }, [date]);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const updateStatus = async (id: number, field: string, value: string) => {
    await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    });
    fetchOrders();
  };

  const confirmDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/orders/${id}`, { 
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete order');
      }
      
      await fetchOrders();
      if (onRefresh) await onRefresh();
      setStatusMessage({ type: 'success', text: 'ลบออเดอร์เรียบร้อยแล้ว' });
    } catch (error) {
      console.error("Delete error:", error);
      setStatusMessage({ type: 'error', text: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบออเดอร์' });
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {orderToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100"
            >
              <div className="flex items-center gap-3 text-rose-600 mb-4">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">ยืนยันการลบออเดอร์</h3>
              </div>
              <p className="text-slate-600 mb-6">
                คุณต้องการลบออเดอร์นี้และคืนสต็อกสินค้าใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setOrderToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => {
                    const id = orderToDelete;
                    setOrderToDelete(null);
                    confirmDelete(id);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-500 transition-colors shadow-lg shadow-rose-200"
                >
                  ยืนยันการลบ
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {statusMessage && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className={cn(
              "fixed bottom-8 right-8 z-[100] px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-3",
              statusMessage.type === 'success' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
            )}
          >
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {statusMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ประวัติการสั่งซื้อ (History)</h1>
          <p className="text-slate-500">ติดตามและจัดการบิลย้อนหลัง</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
            <Clock className="w-4 h-4 text-slate-400" />
            <input 
              type="date" 
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border-none p-0 text-sm focus:ring-0"
            />
          </div>
          {date && (
            <button 
              onClick={() => setDate('')}
              className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white"
            >
              แสดงทั้งหมด
            </button>
          )}
        </div>
      </header>

      <div className="space-y-4">
        {orders.map(order => (
          <Card key={order.id} className="p-0">
            <div className="p-4 flex flex-col md:flex-row justify-between gap-4 border-b border-slate-100">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                  #{order.id}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{order.customer_name}</h4>
                  <p className="text-xs text-slate-500">{format(getThaiTime(order.created_at), 'PPP p')}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <select 
                    value={order.payment_status}
                    onChange={e => updateStatus(order.id, 'payment_status', e.target.value)}
                    className={cn(
                      "text-xs font-bold rounded-full px-3 py-1 border-none cursor-pointer",
                      order.payment_status === 'จ่ายแล้ว' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    <option value="รอโอน">รอโอน</option>
                    <option value="จ่ายแล้ว">จ่ายแล้ว</option>
                  </select>
                  <select 
                    value={order.shipping_status}
                    onChange={e => updateStatus(order.id, 'shipping_status', e.target.value)}
                    className={cn(
                      "text-xs font-bold rounded-full px-3 py-1 border-none cursor-pointer",
                      order.shipping_status === 'ส่งแล้ว' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                    )}
                  >
                    <option value="รอจัดส่ง">รอจัดส่ง</option>
                    <option value="ส่งแล้ว">ส่งแล้ว</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onEdit(order)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="แก้ไขออเดอร์"
                  >
                    <Plus className="w-4 h-4 rotate-45" /> {/* Using Plus rotated as a cross/edit or just use a text button */}
                    <span className="text-xs font-bold ml-1">แก้ไข</span>
                  </button>
                  <button 
                    onClick={() => setOrderToDelete(order.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 font-bold"
                    title="ลบออเดอร์"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-xs">ลบ</span>
                  </button>
                </div>
                <div className="text-right min-w-[100px]">
                  <span className="text-lg font-bold text-slate-900">฿{order.total_price.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{item.product_name} x {item.quantity}</span>
                    <span className="font-medium">฿{(item.quantity * item.price_per_unit).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>ไม่พบออเดอร์ในวันที่เลือก</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AnalyticsPage = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/analytics').then(res => res.json()).then(setData);
  }, []);

  if (!data) return <div className="p-10 text-center">กำลังโหลดข้อมูล (Loading analytics...)</div>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">รายงาน & วิเคราะห์ (Analytics)</h1>
        <p className="text-slate-500">สรุปผลประกอบการธุรกิจ</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-emerald-500" /> ยอดการผลิตรวม (Total Production)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.production}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-500" /> ยอดขายรวม (Total Sales)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="font-bold text-slate-800 mb-4">สินค้าที่ผลิตสูงสุด (Top Produced)</h3>
          <div className="space-y-4">
            {data.production.slice(0, 5).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{i+1}</span>
                  <span className="text-sm font-medium text-slate-700">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{item.total} กก.</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-bold text-slate-800 mb-4">สินค้าที่ขายดีที่สุด (Top Selling)</h3>
          <div className="space-y-4">
            {data.sales.slice(0, 5).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{i+1}</span>
                  <span className="text-sm font-medium text-slate-700">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{item.total} กก.</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState<Category[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const N8N_WEBHOOK_URL = "https://n8n.srv1437056.hstgr.cloud/webhook/bc293181-1527-4e3b-b1a9-868b980f00aa";

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    closeSidebarOnMobile();
  };

  const fetchInventory = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'get_inventory' })
      });
      const data = await res.json();
      console.log('Raw Data from n8n:', data);
      
      // Transform n8n data (Google Sheets) to Category[] structure
      // Expected data: Array<{ Category, "Product Name", "Current Stock", Unit }> or { items: [...] }
      const items = Array.isArray(data) ? data : (data.items || data.inventory || []);
      
      // If it's raw data (doesn't have subCategories), transform it
      if (items.length > 0 && !items[0].subCategories) {
        const grouped: Record<string, Category> = {};
        let catIdCounter = 1;
        let subIdCounter = 1;

        const categoryColors: Record<string, string> = {
          'หมู': '#ef4444',
          'เนื้อ': '#3b82f6',
          'อ.หมู': '#ec4899',
          'อ.เนื้อ': '#22c55e',
          'ปลา': '#0ea5e9'
        };
        const allowedCategories = Object.keys(categoryColors);

        items.forEach((item: any) => {
          const rawCat = (item["Category"] || item["category"] || "").toString().trim();
          const rawName = (item["Product Name"] || "").toString().trim();
          
          let determinedCat = "";
          
          // Priority check: อ.หมู -> อ.เนื้อ -> หมู -> เนื้อ -> ปลา/หมึก
          if (rawCat.includes('อ.หมู') || rawName.includes('อ.หมู')) {
            determinedCat = 'อ.หมู';
          } else if (rawCat.includes('อ.เนื้อ') || rawName.includes('อ.เนื้อ')) {
            determinedCat = 'อ.เนื้อ';
          } else if (rawCat.includes('หมู') || rawName.includes('หมู')) {
            determinedCat = 'หมู';
          } else if (rawCat.includes('เนื้อ') || rawName.includes('เนื้อ')) {
            determinedCat = 'เนื้อ';
          } else if (rawCat.includes('ปลา') || rawName.includes('ปลา') || rawCat.includes('หมึก') || rawName.includes('หมึก')) {
            determinedCat = 'ปลา';
          }

          // Exclude if no match
          if (!determinedCat) return;
          
          if (!grouped[determinedCat]) {
            grouped[determinedCat] = {
              id: catIdCounter++,
              name: determinedCat,
              color: categoryColors[determinedCat],
              subCategories: []
            };
          }

          grouped[determinedCat].subCategories.push({
            id: subIdCounter++,
            category_id: grouped[determinedCat].id,
            name: rawName || "Unknown",
            stock_quantity: parseFloat(item["Current Stock"] || "0"),
            unit: item["Unit"] || "กก."
          });
        });

        setInventory(Object.values(grouped));
      } else {
        // If data is already in correct format or empty
        setInventory(Array.isArray(items) ? items : []);
      }
    } catch (error) {
      console.error("Error fetching inventory from n8n:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard inventory={inventory} onRefresh={fetchInventory} isRefreshing={isRefreshing} />;
      case 'production': return <ProductionInput inventory={inventory} onRefresh={fetchInventory} />;
      case 'orders': return <OrderDispatch inventory={inventory} onRefresh={fetchInventory} editingOrder={editingOrder} setEditingOrder={setEditingOrder} />;
      case 'history': return <HistoryPage 
        onRefresh={fetchInventory}
        onEdit={(order) => {
          setEditingOrder(order);
          setActiveTab('orders');
        }} 
      />;
      case 'analytics': return <AnalyticsPage />;
      default: return <Dashboard inventory={inventory} onRefresh={fetchInventory} isRefreshing={isRefreshing} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 relative">
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 right-0 z-50 w-64 bg-white border-l border-slate-200 transition-transform duration-300 lg:relative lg:left-0 lg:right-auto lg:border-r lg:border-l-0 lg:translate-x-0",
        !isSidebarOpen && "translate-x-full lg:translate-x-0"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <PackagePlus className="text-white w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 leading-tight">Meatball</h2>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Wholesale Pro</p>
              </div>
            </div>

            <nav>
      <SidebarItem 
        icon={LayoutDashboard} 
        label="Dashboard" 
        active={activeTab === 'dashboard'} 
        onClick={() => handleTabChange('dashboard')} 
      />
      <SidebarItem 
        icon={PackagePlus} 
        label="บันทึกการผลิต (Production)" 
        active={activeTab === 'production'} 
        onClick={() => handleTabChange('production')} 
      />
      <SidebarItem 
        icon={ShoppingCart} 
        label="สั่งซื้อ (Order)" 
        active={activeTab === 'orders'} 
        onClick={() => handleTabChange('orders')} 
      />
      <SidebarItem 
        icon={History} 
        label="ประวัติ (History)" 
        active={activeTab === 'history'} 
        onClick={() => handleTabChange('history')} 
      />
      <SidebarItem 
        icon={BarChart3} 
        label="รายงาน (Analytics)" 
        active={activeTab === 'analytics'} 
        onClick={() => handleTabChange('analytics')} 
      />
            </nav>
          </div>
          
          <div className="mt-auto p-6 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">เข้าสู่ระบบโดย (Logged in as)</p>
              <p className="text-sm font-bold text-slate-900 truncate">Admin Wholesale</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              SYSTEM ONLINE
            </div>
          </div>

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
