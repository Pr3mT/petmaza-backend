import logger from '../config/logger';
import { Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import Product from '../models/Product';
import Brand from '../models/Brand';
import User from '../models/User';
import VendorProductPricing from '../models/VendorProductPricing';
import CategoryFulfillerMapping from '../models/CategoryFulfillerMapping';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest, isAdminRole } from '../middlewares/auth';
import { clearCache } from '../middlewares/cache';

// ─── Constants ─────────────────────────────────────────────────────────────────

const VALID_MAIN_CATEGORIES = ['Dog', 'Cat', 'Fish', 'Bird', 'Small Animals'];

const REQUIRED_COLUMNS = [
  'product_name',
  'brand_name',
  'main_category',
  'sub_category',
  'mrp',
  'purchase_price',
  'selling_price',
  'status',
];

const VALID_WEIGHT_UNITS = ['g', 'kg', 'ml', 'l'];

const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  Dog:           'https://placehold.co/400x400/E3F2FD/1565C0?text=Dog',
  Cat:           'https://placehold.co/400x400/FCE4EC/880E4F?text=Cat',
  Fish:          'https://placehold.co/400x400/E0F7FA/006064?text=Fish',
  Bird:          'https://placehold.co/400x400/F3E5F5/4A148C?text=Bird',
  'Small Animals': 'https://placehold.co/400x400/FBE9E7/BF360C?text=Small+Animal',
};

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface BulkRow {
  product_name:   string;
  brand_name:     string;
  main_category:  string;
  sub_category:   string;
  mrp:            string;
  purchase_price: string;
  selling_price:  string;
  status:         string;
  description?:   string;
  weight?:        string;
  weight_unit?:   string;
  size?:          string;
  profit_margin?: string;
  /**
   * "normal"  → auto-assign fulfiller based on category mapping
   * "prime"   → assign to specific prime vendor by their numeric ID
   */
  vendor_type?:      string;
  /**
   * Required when vendor_type = "prime".
   * Must be the numeric primeVendorCode (e.g. 1, 2, 3) shown in the Instructions sheet.
   */
  prime_vendor_id?:  string;
  image_url?:        string;
  stock?:            string;
}

interface RowError {
  row:          number;
  product_name: string;
  errors:       string[];
}

// ─── GET /products/prime-vendors ───────────────────────────────────────────────
/**
 * Returns the list of approved prime vendors for the template dropdown and
 * the prime-vendor assignment dropdown in the frontend upload UI.
 */
export const getActivePrimeVendors = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendors = await User.find({
      role:            'vendor',
      vendorType:      'PRIME',
      isApproved:      true,
      primeVendorCode: { $exists: true },
    })
      .select('_id name email primeVendorCode')
      .sort({ primeVendorCode: 1 })
      .lean();

    res.status(200).json({ success: true, data: vendors });
  } catch (err: any) {
    next(err);
  }
};

// ─── GET /products/bulk-template ───────────────────────────────────────────────
/**
 * Streams an .xlsx file with:
 *  - Data-validation dropdowns for vendor_type, vendor_name, weight_unit,
 *    main_category, and status
 *  - Vendor names are fetched live from the DB so new prime vendors
 *    automatically appear in the dropdown.
 *  - A hidden "_lists" sheet holds the dropdown source data.
 *  - An "Instructions" sheet explains every column.
 */
export const generateBulkTemplate = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Fetch prime vendors dynamically — use primeVendorCode as the dropdown value
    const primeVendors = await User.find({
      role:            'vendor',
      vendorType:      'PRIME',
      isApproved:      true,
      primeVendorCode: { $exists: true },
    })
      .select('name primeVendorCode')
      .sort({ primeVendorCode: 1 })
      .lean();

    // prime_vendor_id dropdown values: the numeric codes (e.g. "1", "2", "3")
    const primeVendorCodeOptions = primeVendors.map(v => String(v.primeVendorCode));

    // ── Workbook ──────────────────────────────────────────────────────────────
    const workbook    = new ExcelJS.Workbook();
    workbook.creator  = 'PetMaza Admin';
    workbook.created  = new Date();

    // ── Hidden sheet: source lists (kept for reference, not used for validation) ──
    const listSheet = workbook.addWorksheet('_lists', { state: 'veryHidden' });
    listSheet.getColumn('A').values = ['vendor_type_list', 'normal', 'prime'];
    listSheet.getColumn('B').values = ['weight_unit_list', ...VALID_WEIGHT_UNITS];
    listSheet.getColumn('C').values = ['category_list', ...VALID_MAIN_CATEGORIES];
    listSheet.getColumn('D').values = ['status_list', 'Active', 'Inactive'];

    // ── Main "Products" sheet ─────────────────────────────────────────────
    const sheet = workbook.addWorksheet('Products', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const COLUMNS: Array<{ header: string; key: string; width: number }> = [
      { header: 'product_name',   key: 'product_name',   width: 32 },
      { header: 'main_category',  key: 'main_category',  width: 18 },
      { header: 'sub_category',   key: 'sub_category',   width: 22 },
      { header: 'brand_name',     key: 'brand_name',     width: 18 },
      { header: 'description',    key: 'description',    width: 36 },
      { header: 'weight',         key: 'weight',         width: 10 },
      { header: 'weight_unit',    key: 'weight_unit',    width: 14 },
      { header: 'size',           key: 'size',           width: 12 },
      { header: 'mrp',            key: 'mrp',            width: 12 },
      { header: 'purchase_price', key: 'purchase_price', width: 16 },
      { header: 'selling_price',  key: 'selling_price',  width: 16 },
      { header: 'stock',          key: 'stock',          width: 12 },
      { header: 'profit_margin',  key: 'profit_margin',  width: 16 },
      { header: 'vendor_type',      key: 'vendor_type',      width: 14 },
      { header: 'prime_vendor_id',   key: 'prime_vendor_id',   width: 18 },
      { header: 'status',            key: 'status',            width: 12 },
    ];
    sheet.columns = COLUMNS;

    // Column-index lookup (1-based)
    const colIdx = (key: string) => COLUMNS.findIndex(c => c.key === key) + 1;

    // Style header row
    const REQUIRED_KEYS = new Set([
      'product_name', 'main_category', 'sub_category', 'brand_name',
      'mrp', 'purchase_price', 'selling_price', 'status',
    ]);
    const headerRow = sheet.getRow(1);
    headerRow.height = 22;
    COLUMNS.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      const isRequired = REQUIRED_KEYS.has(col.key);
      cell.fill = {
        type:    'pattern',
        pattern: 'solid',
        fgColor: { argb: isRequired ? 'FFDC3545' : 'FF1976D2' },
      };
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    // ── Data validation for rows 2–500 ────────────────────────────────────
    // Use sheet.dataValidations.add(range, rule) — one range rule per column.
    // Per-cell loop (getCell().dataValidation = ...) creates 499 individual
    // rules that ExcelJS may not serialize correctly into the xlsx XML.
    // Inline list strings ("val1,val2") avoid the broken cross-sheet ref bug.
    const MAX_ROWS = 500;

    // Helper: convert 1-based column index → Excel column letter (A, B, …, Z, AA, …)
    const toColLetter = (idx: number): string => {
      let letter = '';
      while (idx > 0) {
        const rem = (idx - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        idx = Math.floor((idx - 1) / 26);
      }
      return letter;
    };
    const range = (key: string) => {
      const letter = toColLetter(colIdx(key));
      return `${letter}2:${letter}${MAX_ROWS}`;
    };

    // Inline list strings — Excel expects the formula value to be: "val1,val2"
    // (with the double-quotes as part of the string value)
    const vendorTypeInline   = '"normal,prime"';
    const weightUnitInline   = `"${VALID_WEIGHT_UNITS.join(',')}"`;
    const mainCategoryInline = `"${VALID_MAIN_CATEGORIES.join(',')}"`;
    const statusInline       = '"Active,Inactive"';

    sheet.dataValidations.add(range('vendor_type'), {
      type:             'list',
      allowBlank:       true,
      formulae:         [vendorTypeInline],
      showErrorMessage: true,
      errorTitle:       'Invalid value',
      error:            'Please select: normal or prime',
    });

    // Prime vendor ID dropdown — numeric codes only (Excel inline list capped at 255 chars)
    if (primeVendorCodeOptions.length > 0) {
      const rawCodes      = primeVendorCodeOptions.join(',');
      const safeCodes     = rawCodes.length <= 253 ? rawCodes : rawCodes.substring(0, 253);
      const primeIdInline = `"${safeCodes}"`;
      sheet.dataValidations.add(range('prime_vendor_id'), {
        type:             'list',
        allowBlank:       true,
        formulae:         [primeIdInline],
        showErrorMessage: true,
        errorTitle:       'Invalid prime vendor ID',
        error:            'Please enter a valid prime vendor ID from the Instructions sheet.',
      });
    }

    sheet.dataValidations.add(range('weight_unit'), {
      type:       'list',
      allowBlank: true,
      formulae:   [weightUnitInline],
    });

    sheet.dataValidations.add(range('main_category'), {
      type:             'list',
      allowBlank:       false,
      formulae:         [mainCategoryInline],
      showErrorMessage: true,
      errorTitle:       'Invalid category',
      error:            `Must be one of: ${VALID_MAIN_CATEGORIES.join(', ')}`,
    });

    sheet.dataValidations.add(range('status'), {
      type:             'list',
      allowBlank:       false,
      formulae:         [statusInline],
      showErrorMessage: true,
      errorTitle:       'Invalid status',
      error:            'Must be Active or Inactive',
    });

    // ── Instructions sheet ────────────────────────────────────────────────
    const infoSheet = workbook.addWorksheet('Instructions');
    // Build prime vendor directory for Instructions sheet
    const primeVendorDirectory: string[][] = primeVendors.map(v => [
      `  ID ${v.primeVendorCode}  →  ${v.name}`,
    ]);

    const lines: string[][] = [
      ['PetMaza — Bulk Product Upload Template'],
      [''],
      ['HOW TO USE'],
      ['1. Fill the "Products" sheet. Do NOT modify column headers.'],
      ['2. Red column headers are REQUIRED fields.'],
      ['3. Blue column headers are optional.'],
      [''],
      ['VENDOR TYPES'],
      ['normal → Product auto-assigned to a warehouse fulfiller based on the category mapping.'],
      ['         Set vendor_type = normal. Leave prime_vendor_id blank.'],
      ['prime  → Product listed under a specific prime vendor.'],
      ['         Set vendor_type = prime and prime_vendor_id = the vendor\'s ID number (see directory below).'],
      [''],
      ['PRIME VENDOR ID DIRECTORY'],
      ...(primeVendors.length === 0
        ? [['  (No approved prime vendors yet. Ask admin to approve prime vendors first.)']]
        : primeVendorDirectory),
      [''],
      ['COLUMN RULES'],
      ['main_category   : Must be one of: Dog, Cat, Fish, Bird, Small Animals'],
      ['sub_category    : Free text, e.g. "Dog Food", "Cat Accessories"'],
      ['size            : Optional. Size variant label, e.g. S, M, L, XL, 2XL'],
      ['weight          : Optional. Numeric weight value, e.g. 100'],
      ['weight_unit     : Must be one of: g, kg, ml, l'],
      ['mrp             : Numeric, must be > 0'],
      ['purchase_price  : Numeric'],
      ['selling_price   : Numeric'],
      ['stock           : Optional. Initial stock quantity for this variant (default: 0)'],
      ['profit_margin   : Auto-calculated if left blank'],
      ['status          : Active or Inactive'],
      [''],
      ['MULTI-VARIANT PRODUCTS'],
      ['Add multiple rows with the SAME product_name + main_category + brand_name to define variants.'],
      ['Each row becomes one variant (size-based or weight-based).'],
      ['If no size/weight is provided, a single default variant is created.'],
      ['Same product_name in a DIFFERENT main_category is treated as a separate product.'],
      [''],
      ['NOTE: Images are NOT uploaded via this template. Use the inline image upload in the upload dialog.'],
    ];
    lines.forEach(row => infoSheet.addRow(row));
    infoSheet.getColumn('A').width = 90;
    infoSheet.getRow(1).font  = { bold: true, size: 14, color: { argb: 'FF1565C0' } };
    infoSheet.getRow(3).font  = { bold: true, size: 12 };
    infoSheet.getRow(8).font  = { bold: true, size: 12 };
    // Highlight prime vendor directory header row dynamically
    const dirHeaderRowNum = 14;
    infoSheet.getRow(dirHeaderRowNum).font = { bold: true, size: 12, color: { argb: 'FF6A1B9A' } };
    const colRulesRowNum  = dirHeaderRowNum + 1 + Math.max(primeVendors.length, 1) + 1;
    infoSheet.getRow(colRulesRowNum).font  = { bold: true, size: 12 };

    // ── Stream to response ────────────────────────────────────────────────
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="bulk_products_template.xlsx"'
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err: any) {
    next(err);
  }
};

// ─── POST /products/bulk-upload ────────────────────────────────────────────────
/**
 * Accepts a JSON body: { rows: BulkRow[] }
 * (Frontend parses the xlsx/csv and sends the structured rows.)
 *
 * Vendor assignment logic:
 *  vendor_type = "normal"  → look up CategoryFulfillerMapping by mainCategory (+ subCategory)
 *                            and create a VendorProductPricing record for that fulfiller
 *  vendor_type = "prime"   → look up the prime vendor by primeVendorCode and create a
 *                            PrimeProduct listing for them
 */
export const bulkUploadProducts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;

    if (!isAdminRole(user.role)) {
      return next(new AppError('Only admins can perform bulk product uploads', 403));
    }

    const records: BulkRow[] = req.body?.rows;
    if (!Array.isArray(records) || records.length === 0) {
      return next(new AppError('No product rows provided', 400));
    }

    // ── Pre-load lookup tables ─────────────────────────────────────────────
    const [allBrands, primeVendors, allMappings] = await Promise.all([
      Brand.find({}).select('_id name').lean(),
      User.find({ role: 'vendor', vendorType: 'PRIME', isApproved: true, primeVendorCode: { $exists: true } })
        .select('_id name primeVendorCode')
        .lean(),
      CategoryFulfillerMapping.find({ isActive: true })
        .populate('fulfiller_id', '_id name')
        .lean(),
    ]);

    // brand name (lowercase) → _id
    const brandMap = new Map<string, string>();
    allBrands.forEach(b => brandMap.set(b.name.trim().toLowerCase(), b._id.toString()));

    // primeVendorCode (string) → _id  e.g. "1" → ObjectId("...")
    const primeVendorMap = new Map<string, string>();
    primeVendors.forEach(v => primeVendorMap.set(String(v.primeVendorCode), v._id.toString()));

    // category mapping: "mainCategory:::subCategory" OR "mainCategory:::*" (wildcard) → fulfiller_id
    const categoryFulfillerMap = new Map<string, string>();
    allMappings.forEach(m => {
      const key = m.subCategory
        ? `${m.mainCategory.toLowerCase()}:::${m.subCategory.toLowerCase()}`
        : `${m.mainCategory.toLowerCase()}:::*`;
      categoryFulfillerMap.set(key, (m.fulfiller_id as any)._id.toString());
    });

    // ── Phase 1: Validate each row individually ───────────────────────────
    interface ValidatedRow {
      rowNum:             number;
      productName:        string;
      brandId:            string;
      mainCat:            string;
      subCat:             string;
      mrp:                number;
      purchasePrice:      number;
      sellingPrice:       number;
      purchasePct:        number;
      sellingPct:         number;
      statusVal:          string;
      weight?:            number;
      weightUnit?:        string;
      size?:              string;
      stock:              number;
      description?:       string;
      imageUrl?:          string;
      assignedVendorId:   string | null;
      assignedVendorType: 'WAREHOUSE_FULFILLER' | 'PRIME' | null;
    }

    const validRows:  ValidatedRow[] = [];
    const rowErrors:  RowError[]     = [];

    for (let i = 0; i < records.length; i++) {
      const row    = records[i];
      const rowNum = i + 2; // 1-based row number, +1 for header

      // Skip completely empty rows
      const hasAnyValue = Object.values(row).some(
        v => v !== undefined && v !== null && String(v).trim() !== ''
      );
      if (!hasAnyValue) continue;

      const errors: string[] = [];

      // Required fields
      REQUIRED_COLUMNS.forEach(col => {
        const val = (row as any)[col];
        if (!val || String(val).trim() === '') {
          errors.push(`'${col}' is required`);
        }
      });

      if (errors.length > 0) {
        rowErrors.push({ row: rowNum, product_name: row.product_name || '', errors });
        continue;
      }

      // Numeric fields
      const mrp = parseFloat(row.mrp);
      if (isNaN(mrp) || mrp < 0)
        errors.push("'mrp' must be a non-negative number");

      const purchasePrice = parseFloat(row.purchase_price);
      if (isNaN(purchasePrice) || purchasePrice < 0)
        errors.push("'purchase_price' must be a non-negative number");

      const sellingPrice = parseFloat(row.selling_price);
      if (isNaN(sellingPrice) || sellingPrice < 0)
        errors.push("'selling_price' must be a non-negative number");

      // Stock (optional, defaults to 0)
      const stockRaw = row.stock ? parseInt(String(row.stock), 10) : 0;
      const stock    = isNaN(stockRaw) || stockRaw < 0 ? 0 : stockRaw;

      // Category
      const mainCat = row.main_category.trim();
      if (!VALID_MAIN_CATEGORIES.includes(mainCat))
        errors.push(`'main_category' must be one of: ${VALID_MAIN_CATEGORIES.join(', ')}`);

      // Status
      const statusVal = row.status.trim().toLowerCase();
      if (!['active', 'inactive'].includes(statusVal))
        errors.push("'status' must be 'Active' or 'Inactive'");

      // Weight / unit
      const weight = row.weight ? parseFloat(row.weight) : undefined;
      if (row.weight && isNaN(weight!))
        errors.push("'weight' must be a number");
      if (row.weight_unit && !VALID_WEIGHT_UNITS.includes(row.weight_unit.trim().toLowerCase()))
        errors.push(`'weight_unit' must be one of: ${VALID_WEIGHT_UNITS.join(', ')}`);

      // Vendor type
      const vendorType = row.vendor_type?.trim().toLowerCase() || '';
      if (vendorType && !['normal', 'prime'].includes(vendorType))
        errors.push("'vendor_type' must be 'normal' or 'prime'");

      if (vendorType === 'prime') {
        const codeStr = row.prime_vendor_id?.trim();
        if (!codeStr) {
          errors.push("'prime_vendor_id' is required when vendor_type is 'prime'. Check the Instructions sheet for the ID list.");
        } else if (isNaN(Number(codeStr))) {
          errors.push(`'prime_vendor_id' must be a number (e.g. 1, 2, 3). Got: '${codeStr}'`);
        } else if (!primeVendorMap.has(codeStr)) {
          errors.push(
            `Prime vendor with ID '${codeStr}' not found or not approved. ` +
            `Check the Instructions sheet in the template for the correct ID.`
          );
        }
      }

      // Brand lookup
      const brandId = brandMap.get(row.brand_name.trim().toLowerCase());
      if (!brandId)
        errors.push(`Brand '${row.brand_name}' not found in database`);

      if (errors.length > 0) {
        rowErrors.push({ row: rowNum, product_name: row.product_name || '', errors });
        continue;
      }

      // ── Resolve vendor assignment ──────────────────────────────────────
      let assignedVendorId:   string | null                          = null;
      let assignedVendorType: 'WAREHOUSE_FULFILLER' | 'PRIME' | null = null;

      if (vendorType === 'prime') {
        assignedVendorId   = primeVendorMap.get(row.prime_vendor_id!.trim()) || null;
        assignedVendorType = 'PRIME';
      } else if (vendorType === 'normal') {
        const subKey  = `${mainCat.toLowerCase()}:::${row.sub_category.trim().toLowerCase()}`;
        const wildKey = `${mainCat.toLowerCase()}:::*`;
        assignedVendorId   = categoryFulfillerMap.get(subKey) || categoryFulfillerMap.get(wildKey) || null;
        assignedVendorType = 'WAREHOUSE_FULFILLER';
      }

      // Do NOT round percentages — pre-save hook recalculates prices from them.
      const purchasePct = mrp > 0 ? (purchasePrice / mrp) * 100 : 60;
      const sellingPct  = mrp > 0 ? (sellingPrice  / mrp) * 100 : 80;

      validRows.push({
        rowNum,
        productName:        row.product_name.trim(),
        brandId:            brandId!,
        mainCat,
        subCat:             row.sub_category.trim(),
        mrp,
        purchasePrice,
        sellingPrice,
        purchasePct,
        sellingPct,
        statusVal,
        weight:             weight !== undefined && !isNaN(weight) ? weight : undefined,
        weightUnit:         row.weight_unit?.trim().toLowerCase() || undefined,
        size:               row.size?.trim() || undefined,
        stock,
        description:        row.description?.trim() || undefined,
        imageUrl:           row.image_url?.trim()   || undefined,
        assignedVendorId,
        assignedVendorType,
      });
    }

    // ── Phase 2: Group rows by productName + mainCategory + brandId ────────
    // Rows sharing the same key become variants of ONE product.
    // Same productName in a different mainCategory or different brand → separate product.
    const groupMap = new Map<string, ValidatedRow[]>();
    for (const vRow of validRows) {
      const key = [
        vRow.productName.toLowerCase(),
        vRow.mainCat.toLowerCase(),
        vRow.brandId,
      ].join(':::');
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(vRow);
    }

    // ── Phase 3: Build one product document per group ──────────────────────
    const productsToInsert: Array<Record<string, any>> = [];

    for (const [, rows] of groupMap) {
      const first = rows[0];

      // Each row in the group becomes one variant entry
      const variants = rows.map(r => {
        const variantObj: Record<string, any> = {
          mrp:                r.mrp,
          sellingPrice:       r.sellingPrice,
          sellingPercentage:  r.sellingPct,
          purchasePrice:      r.purchasePrice,
          purchasePercentage: r.purchasePct,
          stock:              r.stock,
          isActive:           r.statusVal === 'active',
        };
        if (r.size) variantObj.size = r.size;
        if (r.weight !== undefined) {
          const unit           = (r.weightUnit || 'g') as 'g' | 'kg' | 'ml' | 'l';
          variantObj.weight       = r.weight;
          variantObj.unit         = unit;
          variantObj.displayWeight = `${r.weight}${unit}`;
        }
        return variantObj;
      });

      const productDoc: Record<string, any> = {
        name:         first.productName,
        brand_id:     first.brandId,
        mainCategory: first.mainCat,
        subCategory:  first.subCat,
        isPrime:      first.assignedVendorType === 'PRIME',
        ...(first.assignedVendorType === 'PRIME' && first.assignedVendorId
          ? { primeVendor_id: first.assignedVendorId }
          : {}),
        hasVariants: true,
        variants,
        isActive: first.statusVal === 'active',
        addedBy:  user._id,
        images: first.imageUrl
          ? [first.imageUrl]
          : [
              CATEGORY_DEFAULT_IMAGES[first.mainCat] ||
              'https://placehold.co/400x400/e8f4ea/333333?text=Product+Image',
            ],
        // Vendor assignment metadata — stripped before DB insert
        _assignedVendorId:   first.assignedVendorId,
        _assignedVendorType: first.assignedVendorType,
      };

      if (first.description) productDoc.description = first.description;

      productsToInsert.push(productDoc);
    }

    // ── Phase 4: Bulk insert ───────────────────────────────────────────────
    let insertedCount = 0;
    const insertErrors: RowError[] = [];

    if (productsToInsert.length > 0) {
      const results = await Promise.allSettled(
        productsToInsert.map(({ _assignedVendorId, _assignedVendorType, ...p }) =>
          Product.create(p)
        )
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          insertedCount++;
          const insertedProduct  = (result as PromiseFulfilledResult<any>).value;
          const vendorId         = productsToInsert[idx]._assignedVendorId;
          const vendorTypeAssign = productsToInsert[idx]._assignedVendorType;

          if (vendorId) {
            // Use first variant's prices for vendor assignment record
            const refVariant = insertedProduct.variants?.[0];
            assignVendor(insertedProduct, vendorId, vendorTypeAssign, refVariant).catch(err =>
              logger.error(`[BulkUpload] Vendor assignment failed for ${insertedProduct._id}:`, err)
            );
          }
        } else {
          const rejected = result as PromiseRejectedResult;
          insertErrors.push({
            row:          -1,
            product_name: productsToInsert[idx].name,
            errors:       [rejected.reason?.message || 'Database insert failed'],
          });
        }
      });
    }

    const allErrors = [...rowErrors, ...insertErrors];
    if (insertedCount > 0) clearCache('/products');

    res.status(200).json({
      success: true,
      data: {
        successCount: insertedCount,
        failedCount:  allErrors.length,
        totalRows:    records.length,
        errors:       allErrors,
      },
      message:
        `Bulk upload complete: ${insertedCount} product(s) created from ` +
        `${records.length} row(s), ${allErrors.length} error(s).`,
    });
  } catch (err: any) {
    next(err);
  }
};

// ─── Internal helper ───────────────────────────────────────────────────────────

async function assignVendor(
  product: any,
  vendorId: string,
  vendorType: 'WAREHOUSE_FULFILLER' | 'PRIME',
  refVariant?: any,
): Promise<void> {
  if (vendorType === 'PRIME') {
    // After unification, mark the Product itself as prime instead of creating a separate listing
    const stockVal = refVariant?.stock ?? 0;
    await Product.findByIdAndUpdate(product._id, {
      $set: {
        isPrime:          true,
        primeVendor_id:   vendorId,
        mrp:              refVariant?.mrp         ?? product.mrp         ?? 0,
        sellingPrice:     refVariant?.sellingPrice ?? product.sellingPrice ?? 0,
        stock:            stockVal,
        minOrderQuantity: 1,
        maxOrderQuantity: 100,
        deliveryTime:     '3-5 business days',
        isActive:         true,
        isAvailable:      stockVal > 0,
      },
    });
  } else {
    await VendorProductPricing.create({
      vendor_id:      vendorId,
      product_id:     product._id,
      purchasePrice:  refVariant?.purchasePrice ?? product.purchasePrice ?? 0,
      availableStock: refVariant?.stock         ?? 0,
      isActive:       true,
    });
  }
}
