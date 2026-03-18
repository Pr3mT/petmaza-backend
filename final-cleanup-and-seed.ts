import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';
import Brand from './src/models/Brand';

dotenv.config();

async function cleanupAndReseed() {
  try {
    console.log('🔄 Connecting to MongoDB...\n');
    await mongoose.connect(process.env.MONGODB_URI!);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗑️  STEP 1: REMOVING INVALID BRANDS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // List of invalid/test brands to remove
    const invalidBrands = [
      'Shreya', 'karan', 'hallofeed', 'samruddhi', 
      'xxx', 'XXX', 'Premmm', 'xxxdsa', 'fafafa', 
      'sefsfsefse', 'xxxgsgege', 'Prem', 'Beapharr',
      'Koli', 'Ninja'
    ];

    const deletedBrands = await Brand.deleteMany({
      name: { $in: invalidBrands }
    });

    console.log(`✅ Deleted ${deletedBrands.deletedCount} invalid brands\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗑️  STEP 2: CLEARING OLD PRODUCTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const deletedProducts = await Product.deleteMany({});
    console.log(`✅ Deleted ${deletedProducts.deletedCount} old products\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏷️  STEP 3: GETTING VALID BRANDS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get remaining valid brands
    const brands = await Brand.find({ isActive: true });
    const brandMap: any = {};
    brands.forEach(brand => {
      brandMap[brand.name] = brand._id;
    });

    console.log(`Found ${brands.length} valid brands\n`);
    brands.forEach(b => console.log(`  - ${b.name}`));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 STEP 4: CREATING PRODUCTS (2-4 per brand)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const products = [];

    // Helper to get brand ID with fallback
    const getBrand = (name: string) => brandMap[name] || brands[0]?._id;

    // ============ DOG PRODUCTS ============
    console.log('🐕 Creating Dog Products...');

    // PEDIGREE (3 products)
    products.push(
      {
        name: 'Pedigree Adult Dry Dog Food - Chicken & Vegetables',
        description: 'Complete nutrition for adult dogs with real chicken',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: getBrand('Pedigree'),
        mrp: 1500,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Pedigree+Adult'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1500, sellingPercentage: 85, isActive: true },
          { weight: 10, unit: 'kg', displayWeight: '10kg', mrp: 4500, sellingPercentage: 85, isActive: true }
        ]
      },
      {
        name: 'Pedigree Puppy Dry Dog Food',
        description: 'Essential nutrition for growing puppies',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: getBrand('Pedigree'),
        mrp: 1400,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Pedigree+Puppy'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1400, sellingPercentage: 85, isActive: true }
        ]
      },
      {
        name: 'Pedigree Gravy Adult Dog Food Wet',
        description: 'Delicious wet food with gravy',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: getBrand('Pedigree'),
        mrp: 80,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Pedigree+Wet'],
        isActive: true
      }
    );

    // ROYAL CANIN (3 products)
    products.push(
      {
        name: 'Royal Canin Maxi Adult Dog Food',
        description: 'Premium food for large breed dogs',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: getBrand('Royal Canin'),
        mrp: 3500,
        sellingPercentage: 90,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=RC+Maxi'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 4, unit: 'kg', displayWeight: '4kg', mrp: 3500, sellingPercentage: 90, isActive: true }
        ]
      },
      {
        name: 'Royal Canin Mini Puppy Food',
        description: 'For small breed puppies up to 10 months',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: getBrand('Royal Canin'),
        mrp: 2800,
        sellingPercentage: 90,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=RC+Mini'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 2, unit: 'kg', displayWeight: '2kg', mrp: 2800, sellingPercentage: 90, isActive: true }
        ]
      },
      {
        name: 'Royal Canin Medium Adult Dog Food',
        description: 'For adult dogs 11-25kg',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: getBrand('Royal Canin'),
        mrp: 3200,
        sellingPercentage: 90,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=RC+Medium'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 4, unit: 'kg', displayWeight: '4kg', mrp: 3200, sellingPercentage: 90, isActive: true }
        ]
      }
    );

    // DROOLS (2 products)
    products.push(
      {
        name: 'Drools Adult Chicken & Egg Dog Food',
        description: 'High protein formula',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: getBrand('Drools'),
        mrp: 1200,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Drools+Adult'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1200, sellingPercentage: 80, isActive: true }
        ]
      },
      {
        name: 'Drools Puppy Small Breed',
        description: 'Complete puppy nutrition',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: getBrand('Drools'),
        mrp: 1100,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Drools+Puppy'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1100, sellingPercentage: 80, isActive: true }
        ]
      }
    );

    // PUREPET (2 products)
    products.push(
      {
        name: 'Purepet Chicken & Vegetables Adult Dog Food',
        description: 'Complete & balanced nutrition',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: getBrand('Purepet'),
        mrp: 950,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Purepet+Adult'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 950, sellingPercentage: 75, isActive: true }
        ]
      },
      {
        name: 'Purepet Puppy Food',
        description: 'Nutritious food for puppies',
        mainCategory: 'Dog',
        subCategory: 'Dog Food',
        brand_id: getBrand('Purepet'),
        mrp: 900,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/FFE5E5/FF6B6B?text=Purepet+Puppy'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 900, sellingPercentage: 75, isActive: true }
        ]
      }
    );

    // HIMALAYA (Dog Medicine - 3 products)
    products.push(
      {
        name: 'Himalaya Erina Coat Cleanser for Dogs',
        description: 'Herbal shampoo for healthy coat',
        mainCategory: 'Dog',
        subCategory: 'Dog Medicine',
        brand_id: getBrand('Himalaya'),
        mrp: 350,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E5FF/4ECDC4?text=Himalaya+Erina'],
        isActive: true
      },
      {
        name: 'Himalaya Scavon Spray for Dogs',
        description: 'Wound healing antiseptic spray',
        mainCategory: 'Dog',
        subCategory: 'Dog Medicine',
        brand_id: getBrand('Himalaya'),
        mrp: 280,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E5FF/4ECDC4?text=Scavon'],
        isActive: true
      },
      {
        name: 'Himalaya Digyton Tablets for Dogs',
        description: 'Digestive support supplement',
        mainCategory: 'Dog',
        subCategory: 'Dog Medicine',
        brand_id: getBrand('Himalaya'),
        mrp: 220,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E5FF/4ECDC4?text=Digyton'],
        isActive: true
      }
    );

    // TRIXIE (Dog Accessories - 3 products)
    products.push(
      {
        name: 'Trixie Nylon Dog Collar - Adjustable',
        description: 'Durable collar for all breeds',
        mainCategory: 'Dog',
        subCategory: 'Dog Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 450,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFF4D4/FFE66D?text=Dog+Collar'],
        isActive: true
      },
      {
        name: 'Trixie Stainless Steel Dog Bowl',
        description: 'Heavy duty feeding bowl',
        mainCategory: 'Dog',
        subCategory: 'Dog Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 350,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFF4D4/FFE66D?text=Dog+Bowl'],
        isActive: true
      },
      {
        name: 'Trixie Grooming Brush for Dogs',
        description: 'Double sided brush',
        mainCategory: 'Dog',
        subCategory: 'Dog Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 550,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFF4D4/FFE66D?text=Brush'],
        isActive: true
      }
    );

    // PETSAFE (Dog Accessories - 2 products)
    products.push(
      {
        name: 'PetSafe Retractable Dog Leash',
        description: '5m retractable cord leash',
        mainCategory: 'Dog',
        subCategory: 'Dog Accessories',
        brand_id: getBrand('PetSafe'),
        mrp: 1200,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/FFF4D4/FFE66D?text=Leash'],
        isActive: true
      },
      {
        name: 'PetSafe Dog Carrier Bag',
        description: 'Comfortable travel carrier',
        mainCategory: 'Dog',
        subCategory: 'Dog Accessories',
        brand_id: getBrand('PetSafe'),
        mrp: 2500,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/FFF4D4/FFE66D?text=Carrier'],
        isActive: true
      }
    );

    // ============ CAT PRODUCTS ============
    console.log('🐱 Creating Cat Products...');

    // WHISKAS (3 products)
    products.push(
      {
        name: 'Whiskas Adult Dry Cat Food - Ocean Fish',
        description: 'Complete nutrition with real fish',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: getBrand('Whiskas'),
        mrp: 450,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=Whiskas+Adult'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 1, unit: 'kg', displayWeight: '1kg', mrp: 450, sellingPercentage: 85, isActive: true },
          { weight: 3, unit: 'kg', displayWeight: '3kg', mrp: 1200, sellingPercentage: 85, isActive: true }
        ]
      },
      {
        name: 'Whiskas Kitten Food',
        description: 'Specially formulated for kittens',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: getBrand('Whiskas'),
        mrp: 420,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=Whiskas+Kitten'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 1, unit: 'kg', displayWeight: '1kg', mrp: 420, sellingPercentage: 85, isActive: true }
        ]
      },
      {
        name: 'Whiskas Wet Food Tuna in Jelly',
        description: 'Tasty wet food for cats',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: getBrand('Whiskas'),
        mrp: 50,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=Whiskas+Wet'],
        isActive: true
      }
    );

    // ROYAL CANIN (Cat - 2 products)
    products.push(
      {
        name: 'Royal Canin Persian Adult Cat Food',
        description: 'Specially for Persian cats',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: getBrand('Royal Canin'),
        mrp: 2800,
        sellingPercentage: 90,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=RC+Persian'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 2, unit: 'kg', displayWeight: '2kg', mrp: 2800, sellingPercentage: 90, isActive: true }
        ]
      },
      {
        name: 'Royal Canin Kitten Food',
        description: 'Complete nutrition for kittens',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: getBrand('Royal Canin'),
        mrp: 1800,
        sellingPercentage: 90,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=RC+Kitten'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 2, unit: 'kg', displayWeight: '2kg', mrp: 1800, sellingPercentage: 90, isActive: true }
        ]
      }
    );

    // MEO (2 products)
    products.push(
      {
        name: 'Me-O Adult Cat Food Tuna',
        description: 'Tuna flavor dry food',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: getBrand('Meo'),
        mrp: 380,
        sellingPercentage: 78,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=Me-O+Tuna'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 1, unit: 'kg', displayWeight: '1kg', mrp: 380, sellingPercentage: 78, isActive: true }
        ]
      },
      {
        name: 'Me-O Seafood Platter Cat Food',
        description: 'Mixed seafood flavor',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: getBrand('Meo'),
        mrp: 400,
        sellingPercentage: 78,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=Me-O+Seafood'],
        isActive: true,
        hasVariants: true,
        variants: [
          { weight: 1, unit: 'kg', displayWeight: '1kg', mrp: 400, sellingPercentage: 78, isActive: true }
        ]
      }
    );

    // SHEBA (2 products)
    products.push(
      {
        name: 'Sheba Premium Cat Food Chicken',
        description: 'Premium wet food with chicken',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: getBrand('Sheba'),
        mrp: 60,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=Sheba+Chicken'],
        isActive: true
      },
      {
        name: 'Sheba Fine Flakes Tuna',
        description: 'Fine flakes in gravy',
        mainCategory: 'Cat',
        subCategory: 'Cat Food',
        brand_id: getBrand('Sheba'),
        mrp: 60,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/E5D4FF/9B59B6?text=Sheba+Tuna'],
        isActive: true
      }
    );

    // HIMALAYA (Cat Medicine - 2 products)
    products.push(
      {
        name: 'Himalaya Erina-EP Shampoo for Cats',
        description: 'Gentle herbal shampoo',
        mainCategory: 'Cat',
        subCategory: 'Cat Medicine',
        brand_id: getBrand('Himalaya'),
        mrp: 320,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Erina+Cat'],
        isActive: true
      },
      {
        name: 'Himalaya Furball Control for Cats',
        description: 'Helps eliminate hairballs',
        mainCategory: 'Cat',
        subCategory: 'Cat Medicine',
        brand_id: getBrand('Himalaya'),
        mrp: 280,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Furball'],
        isActive: true
      }
    );

    // TRIXIE (Cat Accessories - 3 products)
    products.push(
      {
        name: 'Trixie Cat Litter Box with Hood',
        description: 'Large covered litter box',
        mainCategory: 'Cat',
        subCategory: 'Cat Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 1200,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Litter+Box'],
        isActive: true
      },
      {
        name: 'Trixie Cat Scratching Post',
        description: 'Sisal rope scratching post',
        mainCategory: 'Cat',
        subCategory: 'Cat Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 1500,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Scratching+Post'],
        isActive: true
      },
      {
        name: 'Trixie Cat Grooming Glove',
        description: 'Gentle grooming glove',
        mainCategory: 'Cat',
        subCategory: 'Cat Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 380,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/FFD4D4/E74C3C?text=Grooming+Glove'],
        isActive: true
      }
    );

    // ============ FISH PRODUCTS ============
    console.log('🐠 Creating Fish Products...');

    // TETRA (3 products)
    products.push(
      {
        name: 'Tetra Goldfish Flakes',
        description: 'Complete nutrition for goldfish',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: getBrand('Tetra'),
        mrp: 280,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Tetra+Goldfish'],
        isActive: true
      },
      {
        name: 'Tetra Tropical Flakes',
        description: 'Premium flakes for tropical fish',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: getBrand('Tetra'),
        mrp: 320,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Tropical+Flakes'],
        isActive: true
      },
      {
        name: 'Tetra Betta Food',
        description: 'Special formula for betta fish',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: getBrand('Tetra'),
        mrp: 220,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Betta+Food'],
        isActive: true
      }
    );

    // TAIYO (2 products)
    products.push(
      {
        name: 'Taiyo Goldfish Food Premium',
        description: 'Nutritious flakes for goldfish',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: getBrand('Taiyo'),
        mrp: 180,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Taiyo+Goldfish'],
        isActive: true
      },
      {
        name: 'Taiyo Pluset Growth Fish Food',
        description: 'Growth enhancing pellets',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: getBrand('Taiyo'),
        mrp: 250,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Growth+Food'],
        isActive: true
      }
    );

    // HIKARI (2 products)
    products.push(
      {
        name: 'Hikari Gold Fish Food',
        description: 'Premium Japanese fish food',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: getBrand('Hikari'),
        mrp: 450,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Hikari+Gold'],
        isActive: true
      },
      {
        name: 'Hikari Cichlid Food',
        description: 'For cichlid fish',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: getBrand('Hikari'),
        mrp: 480,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Cichlid+Food'],
        isActive: true
      }
    );

    // SERA (2 products)
    products.push(
      {
        name: 'Sera Vipan Fish Flakes',
        description: 'Main food for all ornamental fish',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: getBrand('Sera'),
        mrp: 380,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Sera+Vipan'],
        isActive: true
      },
      {
        name: 'Sera Goldy Fish Food',
        description: 'Special food for goldfish',
        mainCategory: 'Fish',
        subCategory: 'Fish Food',
        brand_id: getBrand('Sera'),
        mrp: 350,
        sellingPercentage: 75,
        images: ['https://via.placeholder.com/400x400/D4F5FF/4ECDC4?text=Sera+Goldy'],
        isActive: true
      }
    );

    // ============ BIRD PRODUCTS ============
    console.log('🐦 Creating Bird Products...');

    // VITAPOL (3 products)
    products.push(
      {
        name: 'Vitapol Budgie Food Economic',
        description: 'Complete food for budgies',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: getBrand('Vitapol'),
        mrp: 280,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Budgie+Food'],
        isActive: true
      },
      {
        name: 'Vitapol Canary Food',
        description: 'Premium food for canaries',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: getBrand('Vitapol'),
        mrp: 260,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Canary+Food'],
        isActive: true
      },
      {
        name: 'Vitapol Lovebird Food',
        description: 'Balanced diet for lovebirds',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: getBrand('Vitapol'),
        mrp: 290,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Lovebird+Food'],
        isActive: true
      }
    );

    // ZUPREEM (2 products)
    products.push(
      {
        name: 'Zupreem Natural Parrot Food',
        description: 'Natural complete diet for parrots',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: getBrand('Zupreem'),
        mrp: 850,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Zupreem+Parrot'],
        isActive: true
      },
      {
        name: 'Zupreem FruitBlend Parrot Food',
        description: 'Fruit flavored pellets',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: getBrand('Zupreem'),
        mrp: 900,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Fruit+Blend'],
        isActive: true
      }
    );

    // HARRISON (2 products)
    products.push(
      {
        name: 'Harrison Adult Lifetime Super Fine',
        description: 'Organic bird food formula',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: getBrand('Harrison'),
        mrp: 1200,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=Harrison+Adult'],
        isActive: true
      },
      {
        name: 'Harrison High Potency Mash',
        description: 'For breeding & molting birds',
        mainCategory: 'Bird',
        subCategory: 'Bird Food',
        brand_id: getBrand('Harrison'),
        mrp: 1300,
        sellingPercentage: 85,
        images: ['https://via.placeholder.com/400x400/FFF4D4/F39C12?text=HP+Mash'],
        isActive: true
      }
    );

    // TRIXIE (Bird Accessories - 3 products)
    products.push(
      {
        name: 'Trixie Bird Cage Medium',
        description: 'Spacious cage for medium birds',
        mainCategory: 'Bird',
        subCategory: 'Bird Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 3500,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E5FF/3498DB?text=Bird+Cage'],
        isActive: true
      },
      {
        name: 'Trixie Wooden Perch',
        description: 'Natural wooden perch',
        mainCategory: 'Bird',
        subCategory: 'Bird Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 280,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E5FF/3498DB?text=Perch'],
        isActive: true
      },
      {
        name: 'Trixie Bird Bath',
        description: 'Hanging bird bath',
        mainCategory: 'Bird',
        subCategory: 'Bird Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 380,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E5FF/3498DB?text=Bird+Bath'],
        isActive: true
      }
    );

    // ============ SMALL ANIMAL PRODUCTS ============
    console.log('🐹 Creating Small Animal Products...');

    // VITAPOL (Small Animals - 3 products)
    products.push(
      {
        name: 'Vitapol Rabbit Food Complete',
        description: 'Complete nutrition for rabbits',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: getBrand('Vitapol'),
        mrp: 320,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=Rabbit+Food'],
        isActive: true
      },
      {
        name: 'Vitapol Hamster Food',
        description: 'Balanced diet for hamsters',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: getBrand('Vitapol'),
        mrp: 220,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=Hamster+Food'],
        isActive: true
      },
      {
        name: 'Vitapol Guinea Pig Food',
        description: 'Vitamin C rich food',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: getBrand('Vitapol'),
        mrp: 280,
        sellingPercentage: 72,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=Guinea+Pig'],
        isActive: true
      }
    );

    // OXBOW (2 products)
    products.push(
      {
        name: 'Oxbow Essential Adult Rabbit Food',
        description: 'Premium rabbit nutrition',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: getBrand('Oxbow'),
        mrp: 1200,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=Oxbow+Rabbit'],
        isActive: true
      },
      {
        name: 'Oxbow Guinea Pig Food',
        description: 'Complete guinea pig nutrition',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: getBrand('Oxbow'),
        mrp: 1100,
        sellingPercentage: 80,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=Oxbow+GP'],
        isActive: true
      }
    );

    // VERSELE-LAGA (2 products)
    products.push(
      {
        name: 'Versele-Laga Crispy Muesli Rabbits',
        description: 'Tasty mix for rabbits',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: getBrand('Versele-Laga'),
        mrp: 950,
        sellingPercentage: 78,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=VL+Rabbit'],
        isActive: true
      },
      {
        name: 'Versele-Laga Crispy Muesli Hamsters',
        description: 'Complete hamster food',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Food',
        brand_id: getBrand('Versele-Laga'),
        mrp: 650,
        sellingPercentage: 78,
        images: ['https://via.placeholder.com/400x400/FFE5D4/E67E22?text=VL+Hamster'],
        isActive: true
      }
    );

    // TRIXIE (Small Animal Accessories - 3 products)
    products.push(
      {
        name: 'Trixie Rabbit Hutch Wooden',
        description: 'Spacious wooden hutch',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 5500,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Rabbit+Hutch'],
        isActive: true
      },
      {
        name: 'Trixie Hamster Cage Complete',
        description: 'Complete hamster habitat',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 2200,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Hamster+Cage'],
        isActive: true
      },
      {
        name: 'Trixie Water Bottle for Small Pets',
        description: 'Drip-free water bottle',
        mainCategory: 'Small Animals',
        subCategory: 'Small Animal Accessories',
        brand_id: getBrand('Trixie'),
        mrp: 280,
        sellingPercentage: 70,
        images: ['https://via.placeholder.com/400x400/D4E8FF/3498DB?text=Water+Bottle'],
        isActive: true
      }
    );

    console.log(`\nTotal products to insert: ${products.length}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 INSERTING PRODUCTS INTO DATABASE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const result = await Product.insertMany(products);
    console.log(`✅ Successfully inserted ${result.length} products!\n`);

    // Show summary by brand
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PRODUCTS BY BRAND');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const brand of brands) {
      const count = await Product.countDocuments({
        brand_id: brand._id,
        isActive: true
      });
      
      if (count > 0) {
        console.log(`${brand.name}: ${count} products`);
      }
    }

    console.log('\n✅ All done! Products evenly distributed across brands!\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

cleanupAndReseed();
