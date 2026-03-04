import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("meatball.db");

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "https://n8n.srv1437056.hstgr.cloud/webhook/bc293181-1527-4e3b-b1a9-868b980f00aa";

async function sendToN8N(payload: any) {
  if (!N8N_WEBHOOK_URL) {
    console.warn('N8N_WEBHOOK_URL is not defined in environment variables');
    return;
  }

  try {
    console.log(`Sending ${payload.type} to n8n...`);
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 404) {
        console.error(`[n8n Error] Webhook ไม่ถูกลงทะเบียน (404):
- ตรวจสอบว่าได้กดเปิด "Active" ใน n8n หรือยัง?
- หากกำลังทดสอบ ให้ใช้ URL ที่มี "/webhook-test/" แทน
- รายละเอียดจาก n8n: ${errorText}`);
      } else {
        console.error(`n8n webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } else {
      console.log(`Successfully sent ${payload.type} to n8n`);
    }
  } catch (error) {
    console.error('Error sending to n8n:', error);
  }
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT
  );
`);

// Migration: Add color column if it doesn't exist (for existing DBs)
const tableInfo = db.prepare("PRAGMA table_info(categories)").all() as any[];
const hasColor = tableInfo.some(col => col.name === 'color');
if (!hasColor) {
  db.exec("ALTER TABLE categories ADD COLUMN color TEXT");
}

const subTableInfo = db.prepare("PRAGMA table_info(sub_categories)").all() as any[];
const hasUnit = subTableInfo.some(col => col.name === 'unit');
if (!hasUnit) {
  db.exec("ALTER TABLE sub_categories ADD COLUMN unit TEXT DEFAULT 'กก.'");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS sub_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    stock_quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'กก.',
    FOREIGN KEY (category_id) REFERENCES categories(id),
    UNIQUE(category_id, name)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    address TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    total_price REAL,
    payment_status TEXT DEFAULT 'รอโอน',
    shipping_status TEXT DEFAULT 'รอจัดส่ง',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    sub_category_id INTEGER,
    quantity REAL,
    price_per_unit REAL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (sub_category_id) REFERENCES sub_categories(id)
  );

  CREATE TABLE IF NOT EXISTS stock_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sub_category_id INTEGER,
    type TEXT CHECK(type IN ('production', 'wastage', 'sale')),
    quantity REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sub_category_id) REFERENCES sub_categories(id)
  );
`);

// Seed initial data if empty or reset if old data is detected
const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
// Check for any old product names to trigger a full reset
const hasOldData = db.prepare("SELECT id FROM sub_categories WHERE name IN ('หมูดี', 'หมูป่อง', 'หมูธรรมดา', 'หมูจิ๋ว', 'เนื้อล้วน') LIMIT 1").get();

if (categoryCount.count === 0 || hasOldData) {
  // Clear old data to fulfill "เอารายการลูกชิ้นเก่าทั่งหมดออก"
  db.exec("DELETE FROM order_items");
  db.exec("DELETE FROM orders");
  db.exec("DELETE FROM stock_logs");
  db.exec("DELETE FROM sub_categories");
  db.exec("DELETE FROM categories");
  
  const insertCat = db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)");
  const insertSub = db.prepare("INSERT INTO sub_categories (category_id, name, stock_quantity) VALUES (?, ?, ?)");
  
  // 1. หมู
  const porkId = insertCat.run("หมู", "#ef4444").lastInsertRowid;
  insertSub.run(porkId, "หมู 1kg.", 100);
  insertSub.run(porkId, "หมู 500g.", 100);
  insertSub.run(porkId, "หมูปอง 1kg.", 100);
  insertSub.run(porkId, "หมูปอง 500g.", 100);
  insertSub.run(porkId, "หมูสาหร่าย 1kg.", 100);
  insertSub.run(porkId, "หมูสาหร่าย 500g.", 100);

  // 2. เนื้อ
  const beefId = insertCat.run("เนื้อ", "#3b82f6").lastInsertRowid;
  insertSub.run(beefId, "เนื้อ 1kg.", 100);
  insertSub.run(beefId, "เนื้อ 500g.", 100);
  insertSub.run(beefId, "เนื้อปอง 1kg.", 100);
  insertSub.run(beefId, "เนื้อปอง 500g.", 100);

  // 3. อ.หมู
  const aPorkId = insertCat.run("อ.หมู", "#ec4899").lastInsertRowid;
  insertSub.run(aPorkId, "อ.หมู 1kg.", 100);
  insertSub.run(aPorkId, "อ.หมู 500g.", 100);
  insertSub.run(aPorkId, "อ.หมูปอง 1kg.", 100);
  insertSub.run(aPorkId, "อ.หมูปอง 500g.", 100);

  // 4. อ.เนื้อ
  const aBeefId = insertCat.run("อ.เนื้อ", "#22c55e").lastInsertRowid;
  insertSub.run(aBeefId, "อ.เนื้อ 1kg.", 100);
  insertSub.run(aBeefId, "อ.เนื้อ 500g.", 100);
  insertSub.run(aBeefId, "อ.เนื้อปอง 1kg.", 100);
  insertSub.run(aBeefId, "อ.เนื้อปอง 500g.", 100);

  // 5. ปลา/อื่นๆ
  const fishId = insertCat.run("ปลา/อื่นๆ", "#0ea5e9").lastInsertRowid;
  insertSub.run(fishId, "ปลาดอลลี่ 1kg.", 100);
  insertSub.run(fishId, "ปลาดอลลี่ 500g.", 100);
  insertSub.run(fishId, "ปลาสาหร่าย 1kg.", 100);
  insertSub.run(fishId, "ปลาสาหร่าย 500g.", 100);
  insertSub.run(fishId, "ปลาจิ๋ว 500g.", 100);
  insertSub.run(fishId, "ปลาหมึก 500g.", 100);

} else {
  // Ensure colors are up to date for existing categories
  const updates = [
    { name: "หมู", color: "#ef4444" },
    { name: "เนื้อ", color: "#3b82f6" },
    { name: "อ.หมู", color: "#ec4899" },
    { name: "อ.เนื้อ", color: "#22c55e" },
    { name: "ปลา/อื่นๆ", color: "#0ea5e9" }
  ];

  for (const up of updates) {
    const exists = db.prepare("SELECT id FROM categories WHERE name = ?").get(up.name) as any;
    if (exists) {
      db.prepare("UPDATE categories SET color = ? WHERE id = ?").run(up.color, exists.id);
    } else {
      db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)").run(up.name, up.color);
    }
  }

  // Seed customers
  const customerList = [
    "N&Pมหาสารคาม", "เจ๊น้องบ้านไผ่", "เจ๊เเมวโนนศิลา", "นางอ๊อด", "ห้องเย็นปิ๊กอ้วนปู",
    "พรสวาทพานิช", "น้องแฝดกระนวน", "เจ๊อีฟตลาดน้ำพองใน", "เเม่สังวาลย์เขาสวนกวาง",
    "P&Pหน้าเมือง", "P&Pศรีเมืองทอง", "P&Pโรงอวน", "P&Pกังสดาร", "P&Pโนนม่วง",
    "P&Pหนองโคตร", "P&Pกาฬสินธุ์", "P&Pร้อยเอ็ด1", "P&Pร้อยเอ็ด2", "P&Pยโสธร",
    "P&Pตลาดเซฟวัน", "P&Pหนองไผ่ล้อม", "P&Pเมืองพล", "P&Pมหาสารคาม", "P&P Super Market",
    "P&Pอุดรธานี", "ไท้ ไก่สดคอนสาร", "โจ ไก่สดโนนหัน", "บัวทองฟู้ดส์สีชมพู",
    "บัวทองฟู้ดส์ชุมแพ", "เจ๊ใหม่", "นิตยาบ้านฝาง", "AP Food Mart", "เจ๊เอ็มประทาย",
    "Def Food", "สมบัติการค้าสารคาม"
  ];

  const insertCustomer = db.prepare("INSERT OR IGNORE INTO customers (name) VALUES (?)");
  for (const customer of customerList) {
    insertCustomer.run(customer);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // API Routes
  
  // Categories & Products
  app.get("/api/inventory", async (req, res) => {
    try {
      // Proxy to n8n for permanent Google Sheets integration
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'get_inventory' })
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching inventory from n8n in backend:", error);
      // Fallback to SQLite if n8n fails (optional, but safer)
      const categories = db.prepare("SELECT * FROM categories").all();
      const inventory = categories.map((cat: any) => ({
        ...cat,
        subCategories: db.prepare("SELECT * FROM sub_categories WHERE category_id = ?").all(cat.id)
      }));
      res.json(inventory);
    }
  });

  app.post("/api/categories", (req, res) => {
    const { name } = req.body;
    try {
      const result = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
      res.json({ id: result.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "มีหมวดหมู่นี้อยู่แล้วในระบบ" });
    }
  });

  app.post("/api/sub-categories", (req, res) => {
    const { categoryId, name } = req.body;
    try {
      const result = db.prepare("INSERT INTO sub_categories (category_id, name, stock_quantity) VALUES (?, ?, 0)").run(categoryId, name);
      res.json({ id: result.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "มีหมวดหมู่ย่อยนี้อยู่ในหมวดหมู่หลักนี้แล้ว" });
    }
  });

  // Stock Management
  app.post("/api/stock/update", async (req, res) => {
    const { subCategoryId, type, quantity } = req.body; // type: 'production', 'wastage'
    const qty = parseFloat(quantity);
    
    const updateStock = db.transaction(() => {
      if (type === 'production') {
        db.prepare("UPDATE sub_categories SET stock_quantity = stock_quantity + ? WHERE id = ?").run(qty, subCategoryId);
      } else if (type === 'wastage') {
        db.prepare("UPDATE sub_categories SET stock_quantity = stock_quantity - ? WHERE id = ?").run(qty, subCategoryId);
      }
      db.prepare("INSERT INTO stock_logs (sub_category_id, type, quantity) VALUES (?, ?, ?)").run(subCategoryId, type, qty);
    });

    updateStock();

    // Fetch updated stock and name for n8n
    const subCategory = db.prepare("SELECT name, stock_quantity FROM sub_categories WHERE id = ?").get(subCategoryId) as any;
    
    await sendToN8N({
      type: 'stock_update',
      update: {
        subCategoryId,
        name: subCategory?.name || "Unknown",
        type,
        quantity: qty,
        currentStock: subCategory?.stock_quantity || 0
      },
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });
  });

  app.post("/api/stock/batch-update", async (req, res) => {
    const { updates } = req.body; // updates: [{ subCategoryId, type, quantity }]
    
    const batchUpdate = db.transaction(() => {
      for (const update of updates) {
        const qty = parseFloat(update.quantity);
        if (qty === 0) continue;

        if (update.type === 'production') {
          db.prepare("UPDATE sub_categories SET stock_quantity = stock_quantity + ? WHERE id = ?").run(qty, update.subCategoryId);
        } else if (update.type === 'wastage') {
          db.prepare("UPDATE sub_categories SET stock_quantity = stock_quantity - ? WHERE id = ?").run(qty, update.subCategoryId);
        }
        db.prepare("INSERT INTO stock_logs (sub_category_id, type, quantity) VALUES (?, ?, ?)").run(update.subCategoryId, update.type, qty);
      }
    });

    batchUpdate();

    // Fetch updated stock and name for n8n
    const updatedItems = updates.map((update: any) => {
      const subCategory = db.prepare("SELECT name, stock_quantity FROM sub_categories WHERE id = ?").get(update.subCategoryId) as any;
      return {
        ...update,
        name: subCategory?.name || "Unknown",
        currentStock: subCategory?.stock_quantity || 0
      };
    });

    // Send to n8n
    await sendToN8N({
      type: 'production_update',
      updates: updatedItems,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true });
  });

  // Customers
  app.get("/api/customers", (req, res) => {
    const customers = db.prepare("SELECT * FROM customers").all();
    res.json(customers);
  });

  app.post("/api/customers", async (req, res) => {
    const { name, address } = req.body;
    try {
      const result = db.prepare("INSERT INTO customers (name, address) VALUES (?, ?)").run(name, address);
      const id = result.lastInsertRowid;

      // Send to n8n
      await sendToN8N({
        type: 'customer_created',
        customer: { id, name, address },
        timestamp: new Date().toISOString()
      });

      res.json({ id });
    } catch (e) {
      res.status(400).json({ error: "มีข้อมูลลูกค้ารายนี้อยู่แล้ว" });
    }
  });

  // Orders
  app.post("/api/orders", async (req, res) => {
    const { customerId, items, totalPrice, billImage } = req.body;
    
    const createOrder = db.transaction(() => {
      const orderResult = db.prepare("INSERT INTO orders (customer_id, total_price) VALUES (?, ?)").run(customerId, totalPrice);
      const orderId = orderResult.lastInsertRowid;

      for (const item of items) {
        db.prepare("INSERT INTO order_items (order_id, sub_category_id, quantity, price_per_unit) VALUES (?, ?, ?, ?)")
          .run(orderId, item.subCategoryId, item.quantity, item.pricePerUnit);
        
        // Deduct stock
        db.prepare("UPDATE sub_categories SET stock_quantity = stock_quantity - ? WHERE id = ?").run(item.quantity, item.subCategoryId);
        
        // Log sale
        db.prepare("INSERT INTO stock_logs (sub_category_id, type, quantity) VALUES (?, 'sale', ?)").run(item.subCategoryId, item.quantity);
      }
      return orderId;
    });

    const orderId = createOrder();

    // Fetch updated items with currentStock for n8n
    const itemsWithStock = items.map((item: any) => {
      const currentStock = db.prepare("SELECT stock_quantity FROM sub_categories WHERE id = ?").get(item.subCategoryId) as any;
      return {
        ...item,
        currentStock: currentStock?.stock_quantity || 0
      };
    });

    // Fetch customer details for n8n
    const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId) as any;

    // Send to n8n
    await sendToN8N({
      type: 'order_created',
      billImage: billImage,
      order: {
        id: orderId,
        customer: customer,
        items: itemsWithStock,
        totalPrice: totalPrice,
        createdAt: new Date().toISOString()
      }
    });

    res.json({ orderId });
  });

  app.get("/api/orders", (req, res) => {
    const { date } = req.query;
    let query = `
      SELECT o.*, c.name as customer_name, c.address as customer_address 
      FROM orders o 
      JOIN customers c ON o.customer_id = c.id
    `;
    const params: any[] = [];
    
    if (date) {
      query += " WHERE DATE(o.created_at, '+7 hours') = DATE(?)";
      params.push(date);
    }
    
    query += " ORDER BY o.created_at DESC";
    
    const orders = db.prepare(query).all(...params);
    const ordersWithItems = orders.map((order: any) => ({
      ...order,
      items: db.prepare(`
        SELECT oi.*, sc.name as product_name 
        FROM order_items oi 
        JOIN sub_categories sc ON oi.sub_category_id = sc.id 
        WHERE oi.order_id = ?
      `).all(order.id)
    }));
    
    res.json(ordersWithItems);
  });

  app.patch("/api/orders/:id/status", (req, res) => {
    const { id } = req.params;
    const { payment_status, shipping_status } = req.body;
    
    if (payment_status) {
      db.prepare("UPDATE orders SET payment_status = ? WHERE id = ?").run(payment_status, id);
    }
    if (shipping_status) {
      db.prepare("UPDATE orders SET shipping_status = ? WHERE id = ?").run(shipping_status, id);
    }
    
    res.json({ success: true });
  });

  app.delete("/api/orders/:id", async (req, res) => {
    const { id } = req.params;
    const numericId = parseInt(id);
    
    if (isNaN(numericId)) {
      return res.status(400).json({ error: "ID ออเดอร์ไม่ถูกต้อง" });
    }
    
    try {
      const deleteOrderTx = db.transaction(() => {
        // 1. Get items to revert stock
        const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(numericId) as any[];
        
        for (const item of items) {
          // Revert stock
          db.prepare("UPDATE sub_categories SET stock_quantity = stock_quantity + ? WHERE id = ?")
            .run(item.quantity, item.sub_category_id);
        }
        
        // 2. Delete items
        db.prepare("DELETE FROM order_items WHERE order_id = ?").run(numericId);
        
        // 3. Delete order
        const result = db.prepare("DELETE FROM orders WHERE id = ?").run(numericId);
        return result.changes > 0;
      });

      const success = deleteOrderTx();

      if (success) {
        // Send to n8n (keep id as string for compatibility)
        await sendToN8N({
          type: 'order_deleted',
          orderId: id,
          timestamp: new Date().toISOString()
        });
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "ไม่พบออเดอร์ที่ต้องการลบ หรือออเดอร์ถูกลบไปแล้ว" });
      }
    } catch (error) {
      console.error("Delete order error:", error);
      res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบออเดอร์บนเซิร์ฟเวอร์: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Analytics
  app.get("/api/analytics", (req, res) => {
    const production = db.prepare(`
      SELECT sc.name, sc.unit, SUM(sl.quantity) as total 
      FROM stock_logs sl 
      JOIN sub_categories sc ON sl.sub_category_id = sc.id 
      WHERE sl.type = 'production' 
      GROUP BY sc.id 
      ORDER BY total DESC
    `).all();

    const sales = db.prepare(`
      SELECT sc.name, sc.unit, SUM(sl.quantity) as total 
      FROM stock_logs sl 
      JOIN sub_categories sc ON sl.sub_category_id = sc.id 
      WHERE sl.type = 'sale' 
      GROUP BY sc.id 
      ORDER BY total DESC
    `).all();

    res.json({ production, sales });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
