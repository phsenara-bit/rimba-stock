/**
 * KATALOG RESMI RIMBA ALAM - 4 KATEGORI UTAMA (NOVEMBER 2026)
 * Sumber: Baris Riil Google Spreadsheet (Nov 2026)
 * Breakdown:
 * - KITCHEN : 267 Barang
 * - BAR (BARISTA) : 117 Barang
 * - PASTRY  : 48 Barang
 * - LAIN-LAIN : 9 Barang
 * Total: 441 Barang
 */

const DEFAULT_CATALOG_ITEMS = [
  {
    "id": 1,
    "name": "Air Kelapa",
    "division": "KITCHEN",
    "unit": "BUAH",
    "price": 15000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 2,
    "name": "Angciu",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 3,
    "name": "Arang Batok_15kG",
    "division": "KITCHEN",
    "unit": "KARUNG",
    "price": 150000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 4,
    "name": "Asam Jawa",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 45000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 5,
    "name": "Ati Ampela",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 35000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 6,
    "name": "Ayam Kampung",
    "division": "KITCHEN",
    "unit": "EKOR",
    "price": 44000,
    "stock": 35,
    "minStock": 5
  },
  {
    "id": 7,
    "name": "Ayam Utuh",
    "division": "KITCHEN",
    "unit": "EKOR",
    "price": 31500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 8,
    "name": "Ayam Cut 4",
    "division": "KITCHEN",
    "unit": "EKOR",
    "price": 31000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 9,
    "name": "Baby Buncis",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 45000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 10,
    "name": "Baking Powder_45gr",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 7000,
    "stock": 1,
    "minStock": 2
  },
  {
    "id": 11,
    "name": "Bakso Ikan",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 25000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 12,
    "name": "Bakso Sapi",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 25550,
    "stock": 14,
    "minStock": 5
  },
  {
    "id": 13,
    "name": "Bawang Bombay",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 35000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 14,
    "name": "Bawang Merah",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 37000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 15,
    "name": "Bawang Putih",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 39000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 16,
    "name": "Bayam",
    "division": "KITCHEN",
    "unit": "IKAT",
    "price": 4000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 17,
    "name": "Beef Knorr",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 90000,
    "stock": 7,
    "minStock": 2
  },
  {
    "id": 18,
    "name": "Bengkoang",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 15000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 19,
    "name": "Beras",
    "division": "KITCHEN",
    "unit": "KARUNG",
    "price": 820000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 20,
    "name": "Bihun",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 7800,
    "stock": 8,
    "minStock": 2
  },
  {
    "id": 21,
    "name": "Biji Mala",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 28000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 22,
    "name": "Biji Pala_50gr",
    "division": "KITCHEN",
    "unit": "GRAM",
    "price": 70,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 23,
    "name": "Biji Wijen",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 24,
    "name": "BlueBand",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 38000,
    "stock": 8,
    "minStock": 2
  },
  {
    "id": 25,
    "name": "Brokoli Hijau",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 26,
    "name": "Bumbu Giling Kari",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 10000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 27,
    "name": "Bumbu Kari Cairo",
    "division": "KITCHEN",
    "unit": "GRAM",
    "price": 200,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 28,
    "name": "Bunga Lawang",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 130000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 29,
    "name": "Buntut / Beef Oxtail",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 155000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 30,
    "name": "Cabe Ijo Kriting",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 55000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 31,
    "name": "Cabe Kering",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 40000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 32,
    "name": "Cabe Merah Besar",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 60000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 33,
    "name": "Cabe Merah Kriting",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 75000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 34,
    "name": "Cabe Rawit Ijo",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 65000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 35,
    "name": "Cabe Rawit Merah",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 85000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 36,
    "name": "Caisim",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 13000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 37,
    "name": "Cengkeh",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 1000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 38,
    "name": "Chicken Knorr @1000gr",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 90280,
    "stock": 16,
    "minStock": 5
  },
  {
    "id": 39,
    "name": "Chili Powder",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 40,
    "name": "Cireng Rujak",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 15300,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 41,
    "name": "Cuka @650ml",
    "division": "KITCHEN",
    "unit": "ML",
    "price": 30,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 42,
    "name": "Cuka Fermentasi @600ml",
    "division": "KITCHEN",
    "unit": "ML",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 43,
    "name": "Cuka Hitam",
    "division": "KITCHEN",
    "unit": "ML",
    "price": 84,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 44,
    "name": "Cumi Tube",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 75000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 45,
    "name": "Cumi Asin",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 130000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 46,
    "name": "Cumi Ring",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 47,
    "name": "Daging Kambing",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 150000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 48,
    "name": "Daging Sapi",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 140000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 49,
    "name": "Daun Bawang",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 28000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 50,
    "name": "Daun Bay leaves",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 2500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 51,
    "name": "Daun Jeruk",
    "division": "KITCHEN",
    "unit": "LEMBAR",
    "price": 50,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 52,
    "name": "Daun Ketumbar",
    "division": "KITCHEN",
    "unit": "LEMBAR",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 53,
    "name": "Daun Kunyit",
    "division": "KITCHEN",
    "unit": "LEMBAR",
    "price": 500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 54,
    "name": "Daun Pandan",
    "division": "KITCHEN",
    "unit": "LEMBAR",
    "price": 500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 55,
    "name": "Daun Pisang",
    "division": "KITCHEN",
    "unit": "IKAT",
    "price": 5000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 56,
    "name": "Daun Salam",
    "division": "KITCHEN",
    "unit": "LEMBAR",
    "price": 300,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 57,
    "name": "Daun Seledri",
    "division": "KITCHEN",
    "unit": "GRAM",
    "price": 40,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 58,
    "name": "Daun Singkong",
    "division": "KITCHEN",
    "unit": "IKAT",
    "price": 2500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 59,
    "name": "Ebi",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 118000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 60,
    "name": "Emping",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 83000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 61,
    "name": "French Fries",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 25500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 62,
    "name": "Garam Segitiga @250gr",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 2200,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 63,
    "name": "Garam Revina",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 64,
    "name": "Gula Aren @250gr",
    "division": "KITCHEN",
    "unit": "PASANG",
    "price": 12000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 65,
    "name": "Iga",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 95000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 66,
    "name": "Ikan Asin",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 95000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 67,
    "name": "Ikan Dori",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 43000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 68,
    "name": "Ikan Gurame",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 53000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 69,
    "name": "Ikan Gurame Fillet",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 85000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 70,
    "name": "Ikan Nila",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 40000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 71,
    "name": "Jagung Kaleng @420gr",
    "division": "KITCHEN",
    "unit": "CAN",
    "price": 19000,
    "stock": 61,
    "minStock": 5
  },
  {
    "id": 72,
    "name": "Jagung Manis",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 4000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 73,
    "name": "Jagung Putren",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 19000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 74,
    "name": "Jahe",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 28000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 75,
    "name": "Jamur Kuping",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 35000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 76,
    "name": "Jeruk Limo",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 55000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 77,
    "name": "Jeruk Nipis",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 40000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 78,
    "name": "Jeruk Sonkit",
    "division": "KITCHEN",
    "unit": "ML",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 79,
    "name": "Jinten",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 100000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 80,
    "name": "Kacang Kedelai",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 16,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 81,
    "name": "Kacang Panjang",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 17000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 82,
    "name": "Kacang Tanah",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 55000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 83,
    "name": "Kacang Tanah Giling",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 55000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 84,
    "name": "Kai Lan",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 25000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 85,
    "name": "Kangkung",
    "division": "KITCHEN",
    "unit": "IKAT",
    "price": 3000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 86,
    "name": "Kapulaga",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 175,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 87,
    "name": "Kayu Manis",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 95,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 88,
    "name": "Kecap Asin_620ml",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 38000,
    "stock": 2,
    "minStock": 2
  },
  {
    "id": 89,
    "name": "Kecap Hitam_500ml",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 42000,
    "stock": 4,
    "minStock": 2
  },
  {
    "id": 90,
    "name": "Kecap Ikan @725ml",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 38000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 91,
    "name": "Kecap Inggris_620ml",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 38000,
    "stock": 3,
    "minStock": 2
  },
  {
    "id": 92,
    "name": "Kecap Manis @5000ml",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 36000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 93,
    "name": "Kecombrang",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 4000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 94,
    "name": "Keju (Kitchen)",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 55000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 95,
    "name": "Kelapa Parut",
    "division": "KITCHEN",
    "unit": "BUAH",
    "price": 14000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 96,
    "name": "Kemangi",
    "division": "KITCHEN",
    "unit": "IKAT",
    "price": 1000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 97,
    "name": "Kembang Kol",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 35000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 98,
    "name": "Kemiri",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 52000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 99,
    "name": "Kencur",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 60000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 100,
    "name": "Kentang",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 20000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 101,
    "name": "Kerongkongan",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 18000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 102,
    "name": "Kerupuk Sari Udang @5000gr",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 103,
    "name": "Kerupuk Udang Besar",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 47000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 104,
    "name": "Ketumbar",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 35000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 105,
    "name": "Kol",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 12000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 106,
    "name": "Kol Ungu",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 45000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 107,
    "name": "Kucai",
    "division": "KITCHEN",
    "unit": "IKAT",
    "price": 5000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 108,
    "name": "Kulit Pangsit",
    "division": "KITCHEN",
    "unit": "LEMBAR",
    "price": 11000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 109,
    "name": "Kunyit",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 17000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 110,
    "name": "Kunyit Powder @120gr",
    "division": "KITCHEN",
    "unit": "RCNG",
    "price": 15000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 111,
    "name": "Kwetiaw_500gr",
    "division": "KITCHEN",
    "unit": "GRAM",
    "price": 14,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 112,
    "name": "Labu Kuning",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 15000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 113,
    "name": "Labu Siam",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 17000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 114,
    "name": "Lada Hitam",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 170000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 115,
    "name": "Lada Putih",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 155000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 116,
    "name": "Lemak",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 60000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 117,
    "name": "Lengkuas",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 17000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 118,
    "name": "Lobak Putih",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 119,
    "name": "Lontong",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 2500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 120,
    "name": "Maggi Seasoning_800ml",
    "division": "KITCHEN",
    "unit": "ML",
    "price": 94,
    "stock": 3198,
    "minStock": 5
  },
  {
    "id": 121,
    "name": "Master Acar Timun",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 122,
    "name": "Master Asam Manis",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 123,
    "name": "Master Ayam Bekakak",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 124,
    "name": "Master Ayam Goreng Mentega Prasmanan",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 125,
    "name": "Master Ayam Kalasan",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 126,
    "name": "Master Ayam Ketumbar",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 127,
    "name": "Master Ayam Lada Garam",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 128,
    "name": "Master Ayam Lada Hitam",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 129,
    "name": "Master Ayam Lengkuas",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 130,
    "name": "Master Ayam Mentega",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 131,
    "name": "Master Ayam PSK",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 132,
    "name": "Master Ayam Serundeng",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 133,
    "name": "Master Ayam Taliwang",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 134,
    "name": "Master Ayam Woku",
    "division": "KITCHEN",
    "unit": "EKOR",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 135,
    "name": "Master Baby Buncis Garlic",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 136,
    "name": "Master Balacan",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 137,
    "name": "Master Bayam",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 138,
    "name": "Master Bubur Manado",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 139,
    "name": "Master Bumbu Iga Bakar",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 140,
    "name": "Master Bumbu Kacang",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 141,
    "name": "Master Bumbu Rujak",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 142,
    "name": "Master Buntil Singkong",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 143,
    "name": "Master CapCay",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 144,
    "name": "Master Chilli Oil",
    "division": "KITCHEN",
    "unit": "EKOR",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 145,
    "name": "Master Gurame",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 146,
    "name": "Master Kaldu Ayam",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 147,
    "name": "Master Kentang Mustofa",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 148,
    "name": "Master Koya",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 149,
    "name": "Master Kuah Soto Santan",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 150,
    "name": "Master Labu Siam",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 151,
    "name": "Master Lumpia",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 152,
    "name": "Master Lumpia Sayur",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 153,
    "name": "Master Mie Goreng",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 154,
    "name": "Master Nasi Daun Jeruk",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 155,
    "name": "Master Nasi Kecombrang",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 156,
    "name": "Master Nasi Putih",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 157,
    "name": "Master Nasi Tutug Oncom",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 158,
    "name": "Master Orek Tempe",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 159,
    "name": "Master Oseng Cumi Asin",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 160,
    "name": "Master Oseng Teri Medan",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 161,
    "name": "Master Pecak Ikan",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 162,
    "name": "Master Pesmol",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 163,
    "name": "Master Rolade Telor",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 164,
    "name": "Master Sambal Buntut",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 165,
    "name": "Master Sambal Pong Pong",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 166,
    "name": "Master Sambal PSK",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 167,
    "name": "Master Saoce X.O",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 168,
    "name": "Master Saos Lada Hitam",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 169,
    "name": "Master Saos Padang",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 170,
    "name": "Master Sate Ayam",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 171,
    "name": "Master Sate Kambing",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 172,
    "name": "Master Sate Lilit",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 173,
    "name": "Master Sate Prasmanan",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 174,
    "name": "Master Sate Sapi",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 175,
    "name": "Master Sauce BBQ",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 176,
    "name": "Master Sauce Ikan Steam",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 177,
    "name": "Master Sauce Kungpao",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 178,
    "name": "Master Sauce Mangga",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 179,
    "name": "Master Serundeng",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 180,
    "name": "Master Singkong Keju",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 181,
    "name": "Master Sop Buntut",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 182,
    "name": "Master Sop Iga",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 183,
    "name": "Master Soto Ayam",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 184,
    "name": "Master Sup Ayam",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 185,
    "name": "Master Sup Daging",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 186,
    "name": "Master Sup Jagung Ayam",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 187,
    "name": "Master Tahu Isi",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 188,
    "name": "Master Tahu Tempe Ungkep",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 189,
    "name": "Master Telur Dadar",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 190,
    "name": "Master Tepung Kombinasi",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 191,
    "name": "Master Tepung Pisang Goreng",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 192,
    "name": "Master Toping Ayam Bakso",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 193,
    "name": "Master Toping Kambing",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 194,
    "name": "Master Toping Seafood",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 195,
    "name": "Master Vietnam Sauce",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 196,
    "name": "Master Wonton",
    "division": "KITCHEN",
    "unit": "PORSI",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 197,
    "name": "Mie Atom",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 5900,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 198,
    "name": "Minyak Goreng @2000ml",
    "division": "KITCHEN",
    "unit": "POUCH",
    "price": 41833,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 199,
    "name": "Minyak Sayur",
    "division": "KITCHEN",
    "unit": "POUCH",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 200,
    "name": "Minyak Ikan",
    "division": "KITCHEN",
    "unit": "ML",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 201,
    "name": "Minyak Wijen_600ml",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 38000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 202,
    "name": "Nanas",
    "division": "KITCHEN",
    "unit": "BUAH",
    "price": 12000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 203,
    "name": "Nestum Sereal",
    "division": "KITCHEN",
    "unit": "GRAM",
    "price": 170,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 204,
    "name": "Nugget #500gr",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 26500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 205,
    "name": "Oncom",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 2000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 206,
    "name": "Paha Ayam Fillet",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 51000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 207,
    "name": "Paha Ayam Pentung",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 208,
    "name": "Paprika Powder",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 209,
    "name": "Parsley Flakes",
    "division": "KITCHEN",
    "unit": "GRAM",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 210,
    "name": "Pisang",
    "division": "KITCHEN",
    "unit": "SISIR",
    "price": 30000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 211,
    "name": "Plum Sauce",
    "division": "KITCHEN",
    "unit": "GRAM",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 212,
    "name": "Polingcai",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 213,
    "name": "Quavit Galon 19 Liter",
    "division": "KITCHEN",
    "unit": "GALON",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 214,
    "name": "Rosemary Leaves",
    "division": "KITCHEN",
    "unit": "GRAM",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 215,
    "name": "Sambel Roa",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 175000,
    "stock": 2,
    "minStock": 2
  },
  {
    "id": 216,
    "name": "Santan Kara/Kelapa",
    "division": "KITCHEN",
    "unit": "ML",
    "price": 90,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 217,
    "name": "Saos Sambal",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 115000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 218,
    "name": "Saos Thailand_980ml",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 58000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 219,
    "name": "Saos Tiram @2200ml",
    "division": "KITCHEN",
    "unit": "KLNG",
    "price": 105000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 220,
    "name": "Saos Tomat @5000ml",
    "division": "KITCHEN",
    "unit": "GALON",
    "price": 95000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 221,
    "name": "Sasa",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 50000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 222,
    "name": "Sauce Cuka Fermentasi @500gr",
    "division": "KITCHEN",
    "unit": "ML",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 223,
    "name": "Sawi Putih",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 18000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 224,
    "name": "Sayap Ayam",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 5000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 225,
    "name": "Sayur Asam",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 10000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 226,
    "name": "Selada Kriting",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 30000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 227,
    "name": "Sereh",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 28000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 228,
    "name": "Singkong",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 10000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 229,
    "name": "Singkong Argotelo_700gr",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 22000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 230,
    "name": "Sosis @1kg = 40pcs",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 1125,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 231,
    "name": "Soun Naga 250gr",
    "division": "KITCHEN",
    "unit": "GRAM",
    "price": 36,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 232,
    "name": "Soy Souce Kikkoman_1,6L",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 108000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 233,
    "name": "Spring Roll #20",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 19647,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 234,
    "name": "Spring Roll #30",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 37000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 235,
    "name": "Tahu Bandung/Kuning",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 10000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 236,
    "name": "Tahu Pong",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 1000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 237,
    "name": "Tahu Putih/Tahu Cina",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 7000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 238,
    "name": "Telur @240btr",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 23667,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 239,
    "name": "Telur Bebek",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 4500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 240,
    "name": "Tempe",
    "division": "KITCHEN",
    "unit": "PAPAN",
    "price": 10000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 241,
    "name": "Tempe Mendoan",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 4000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 242,
    "name": "Temukunci",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 30000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 243,
    "name": "Tepung Beras_500gr",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 10000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 244,
    "name": "Tepung Custard",
    "division": "KITCHEN",
    "unit": "KLNG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 245,
    "name": "Tepung Hercules_450gr",
    "division": "KITCHEN",
    "unit": "KLNG",
    "price": 53000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 246,
    "name": "Tepung Maizena",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 24000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 247,
    "name": "Tepung Roti",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 18000,
    "stock": 8.2,
    "minStock": 2
  },
  {
    "id": 248,
    "name": "Tepung Tapioka_500gr",
    "division": "KITCHEN",
    "unit": "PACK",
    "price": 10000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 249,
    "name": "Tepung Terigu",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 12000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 250,
    "name": "Terasi",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 59000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 251,
    "name": "Teri",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 135000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 252,
    "name": "Terong Bulat Ijo",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 15000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 253,
    "name": "Terong Ungu",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 15000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 254,
    "name": "Tetelan",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 60000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 255,
    "name": "Timun",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 19000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 256,
    "name": "Tofu",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 10000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 257,
    "name": "Toge",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 16000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 258,
    "name": "Tomat Hijau",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 15000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 259,
    "name": "Tomat Merah",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 19000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 260,
    "name": "Tomato Pasta",
    "division": "KITCHEN",
    "unit": "GRAM",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 261,
    "name": "Ubi",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 15000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 262,
    "name": "Udang Kulit",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 263,
    "name": "Udang Kupas",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 264,
    "name": "Vanili Cair_60Ml",
    "division": "KITCHEN",
    "unit": "BOTOL",
    "price": 11000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 265,
    "name": "Wortel",
    "division": "KITCHEN",
    "unit": "KG",
    "price": 20000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 266,
    "name": "Panada",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 6000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 267,
    "name": "Lalampa",
    "division": "KITCHEN",
    "unit": "PCS",
    "price": 6000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 268,
    "name": "Amidis 330Ml",
    "division": "BAR",
    "unit": "CARTON",
    "price": 40700,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 269,
    "name": "Amidis Galon 19 Liter",
    "division": "BAR",
    "unit": "GALON",
    "price": 18000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 270,
    "name": "Anggur",
    "division": "BAR",
    "unit": "PACK",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 271,
    "name": "Aqua Gelas",
    "division": "BAR",
    "unit": "CARTON",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 272,
    "name": "Batang Sereh",
    "division": "BAR",
    "unit": "PCS",
    "price": 720,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 273,
    "name": "Beans Espresso",
    "division": "BAR",
    "unit": "KG",
    "price": 250500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 274,
    "name": "Beans Robusta",
    "division": "BAR",
    "unit": "KG",
    "price": 155000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 275,
    "name": "Beans V60",
    "division": "BAR",
    "unit": "KG",
    "price": 527000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 276,
    "name": "Biji Selasih",
    "division": "BAR",
    "unit": "GRAM",
    "price": 125,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 277,
    "name": "Brown Sugar Stick",
    "division": "BAR",
    "unit": "PCS",
    "price": 367,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 278,
    "name": "Buah Alpukat",
    "division": "BAR",
    "unit": "KG",
    "price": 40000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 279,
    "name": "Buah Jambu Merah",
    "division": "BAR",
    "unit": "KG",
    "price": 20000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 280,
    "name": "Buah Mangga",
    "division": "BAR",
    "unit": "KG",
    "price": 37500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 281,
    "name": "Buah Melon",
    "division": "BAR",
    "unit": "KG",
    "price": 20000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 282,
    "name": "Buah Pepaya",
    "division": "BAR",
    "unit": "KG",
    "price": 20000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 283,
    "name": "Buah Semangka",
    "division": "BAR",
    "unit": "KG",
    "price": 18000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 284,
    "name": "Buah Strawberry",
    "division": "BAR",
    "unit": "PACK",
    "price": 15000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 285,
    "name": "Butter Anchor",
    "division": "BAR",
    "unit": "GRAM",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 286,
    "name": "Cendol Kecebong",
    "division": "BAR",
    "unit": "KG",
    "price": 17738,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 287,
    "name": "Cincau",
    "division": "BAR",
    "unit": "PACK",
    "price": 10000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 288,
    "name": "Creamer Powder",
    "division": "BAR",
    "unit": "KG",
    "price": 43000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 289,
    "name": "Catcher Creme Chocolate Powder",
    "division": "BAR",
    "unit": "KG",
    "price": 189810,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 290,
    "name": "Catcher Creme Matcha Powder",
    "division": "BAR",
    "unit": "KG",
    "price": 171000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 291,
    "name": "Dairy Champ",
    "division": "BAR",
    "unit": "GRAM",
    "price": 25,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 292,
    "name": "Daun Mint Kering",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 293,
    "name": "Daun Stevia",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 294,
    "name": "Delifru Butterscotch",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 295,
    "name": "Delifru Caramel",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 296,
    "name": "Delifru Cotton Candy",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 297,
    "name": "Delifru Grenadine",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 298,
    "name": "Delifru Hazelnut",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 299,
    "name": "Delifru Irish Cream",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 300,
    "name": "Delifru Lychee",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 301,
    "name": "Delifru Mix Berries",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 302,
    "name": "Delifru Mojito",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 303,
    "name": "Delifru Salted Caramel",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 304,
    "name": "Delifru Stawberry",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 305,
    "name": "Delifru Vanilla",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 306,
    "name": "Earl Grey Sauce_2ltr",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 240426,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 307,
    "name": "Es Batu",
    "division": "BAR",
    "unit": "BALL",
    "price": 20000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 308,
    "name": "Es Krim Chocolate",
    "division": "BAR",
    "unit": "PL",
    "price": 156000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 309,
    "name": "Es Krim Strawberry",
    "division": "BAR",
    "unit": "PL",
    "price": 173160,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 310,
    "name": "Es Krim Vanilla",
    "division": "BAR",
    "unit": "PL",
    "price": 156000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 311,
    "name": "Es Sirsak",
    "division": "BAR",
    "unit": "PACK",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 312,
    "name": "Goldenfil Blueberry",
    "division": "BAR",
    "unit": "KG",
    "price": 55000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 313,
    "name": "Goldenfil Chocolate",
    "division": "BAR",
    "unit": "KG",
    "price": 55000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 314,
    "name": "Goldenfil Strawberry",
    "division": "BAR",
    "unit": "KG",
    "price": 55000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 315,
    "name": "Green Tea Chatramue",
    "division": "BAR",
    "unit": "PACK",
    "price": 62900,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 316,
    "name": "Greenfields Fresh Milk",
    "division": "BAR",
    "unit": "LITER",
    "price": 19739,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 317,
    "name": "Gula Alus",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 318,
    "name": "Gula Aren Semut",
    "division": "BAR",
    "unit": "KG",
    "price": 42735,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 319,
    "name": "Gula Batu",
    "division": "BAR",
    "unit": "KG",
    "price": 37000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 320,
    "name": "Gula Pasir",
    "division": "BAR",
    "unit": "KG",
    "price": 19000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 321,
    "name": "Jelly Coffee @20gr",
    "division": "BAR",
    "unit": "GRAM",
    "price": 467,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 322,
    "name": "Jelly Dring @15gr",
    "division": "BAR",
    "unit": "GRAM",
    "price": 533,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 323,
    "name": "Jeruk Bali",
    "division": "BAR",
    "unit": "KG",
    "price": 37000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 324,
    "name": "Jeruk Nipis Bar",
    "division": "BAR",
    "unit": "KG",
    "price": 38000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 325,
    "name": "Jeruk Peras / Pontianak",
    "division": "BAR",
    "unit": "KG",
    "price": 23000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 326,
    "name": "Kacang Kenari",
    "division": "BAR",
    "unit": "PACK",
    "price": 15000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 327,
    "name": "Kayu secang",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 328,
    "name": "Keju Prociz",
    "division": "BAR",
    "unit": "KG",
    "price": 56500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 329,
    "name": "Kolang Kaling",
    "division": "BAR",
    "unit": "GRAM",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 330,
    "name": "Kopi Bubuk",
    "division": "BAR",
    "unit": "GRAM",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 331,
    "name": "Lemon CF",
    "division": "BAR",
    "unit": "KG",
    "price": 45000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 332,
    "name": "Lemon Kering",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 333,
    "name": "Lychee Kaleng (1 klng = 15 pcs )",
    "division": "BAR",
    "unit": "KLNG",
    "price": 31250,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 334,
    "name": "Madu",
    "division": "BAR",
    "unit": "GRAM",
    "price": 75,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 335,
    "name": "Master Air Sereh",
    "division": "BAR",
    "unit": "PACK",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 336,
    "name": "Master Creamer cair",
    "division": "BAR",
    "unit": "ML",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 337,
    "name": "Master Jelly Drink",
    "division": "BAR",
    "unit": "ML",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 338,
    "name": "Master Lemon Tea",
    "division": "BAR",
    "unit": "PACK",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 339,
    "name": "Master Pancake & Waffle",
    "division": "BAR",
    "unit": "PCS",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 340,
    "name": "Master Selasih",
    "division": "BAR",
    "unit": "GRAM",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 341,
    "name": "Master Simple Syrup",
    "division": "BAR",
    "unit": "ML",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 342,
    "name": "Master Simple Syrup Aren",
    "division": "BAR",
    "unit": "ML",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 343,
    "name": "Master Tea",
    "division": "BAR",
    "unit": "ML",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 344,
    "name": "Nangka",
    "division": "BAR",
    "unit": "KG",
    "price": 40000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 345,
    "name": "Nata De Coco",
    "division": "BAR",
    "unit": "GRAM",
    "price": 16000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 346,
    "name": "Nestea LemonTea",
    "division": "BAR",
    "unit": "KG",
    "price": 64000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 347,
    "name": "Pewarna Makanan",
    "division": "BAR",
    "unit": "ML",
    "price": 12,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 348,
    "name": "Pistachio Sauce_1Ltr",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 332500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 349,
    "name": "Powder Avocado",
    "division": "BAR",
    "unit": "KG",
    "price": 60000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 350,
    "name": "Powder Banana",
    "division": "BAR",
    "unit": "KG",
    "price": 60000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 351,
    "name": "Powder Chocolate",
    "division": "BAR",
    "unit": "KG",
    "price": 60000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 352,
    "name": "Powder Red Velvet",
    "division": "BAR",
    "unit": "KG",
    "price": 60000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 353,
    "name": "Powder Strawberry",
    "division": "BAR",
    "unit": "KG",
    "price": 60000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 354,
    "name": "Powder Mangga",
    "division": "BAR",
    "unit": "KG",
    "price": 60000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 355,
    "name": "Powder Taro",
    "division": "BAR",
    "unit": "KG",
    "price": 60000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 356,
    "name": "Roti",
    "division": "BAR",
    "unit": "GRAM",
    "price": 33000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 357,
    "name": "Sagu Mutiara",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 358,
    "name": "Sedotan",
    "division": "BAR",
    "unit": "PACK",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 359,
    "name": "Sirsak",
    "division": "BAR",
    "unit": "KG",
    "price": 45000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 360,
    "name": "SKM Carnation",
    "division": "BAR",
    "unit": "KLNG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 361,
    "name": "SKM Coklat Bar @370ml",
    "division": "BAR",
    "unit": "ML",
    "price": 36,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 362,
    "name": "Soda Zoda",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 4375,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 363,
    "name": "Sp Kue",
    "division": "BAR",
    "unit": "GRAM",
    "price": 336,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 364,
    "name": "Sunquick Lemon",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 365,
    "name": "Syrup Anggur",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 366,
    "name": "Syrup Apel",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 367,
    "name": "Syrup Nanas",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 24000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 368,
    "name": "Syrup Pisang Ambon",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 24000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 369,
    "name": "Syrup Strawberry",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 110000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 370,
    "name": "Teh Apple Blossom",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 371,
    "name": "Teh Bunga Telang",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 372,
    "name": "Teh Chrysanthemum",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 373,
    "name": "Teh Cincau/Liang",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 374,
    "name": "Teh Goalpara",
    "division": "BAR",
    "unit": "PACK",
    "price": 13058,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 375,
    "name": "Teh Red Rose",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 376,
    "name": "Teh Rosella",
    "division": "BAR",
    "unit": "KG",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 377,
    "name": "Temulawak",
    "division": "BAR",
    "unit": "KG",
    "price": 43000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 378,
    "name": "Thai Tea Chatramue",
    "division": "BAR",
    "unit": "PACK",
    "price": 65000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 379,
    "name": "Twinings Lemon & Ginger_2gr",
    "division": "BAR",
    "unit": "PCS",
    "price": 102120,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 380,
    "name": "Twinings Peach Tea Bag-2gr",
    "division": "BAR",
    "unit": "PCS",
    "price": 84360,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 381,
    "name": "Whipping Cream Millac Gold",
    "division": "BAR",
    "unit": "LITER",
    "price": 65600,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 382,
    "name": "White Sugar Stick",
    "division": "BAR",
    "unit": "PCS",
    "price": 243,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 383,
    "name": "Wisman @200gr",
    "division": "BAR",
    "unit": "GRAM",
    "price": 450,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 384,
    "name": "Yakult",
    "division": "BAR",
    "unit": "BOTOL",
    "price": 0,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 385,
    "name": "Blueband Margarine",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 42,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 386,
    "name": "Buah Cherry",
    "division": "PASTRY",
    "unit": "PCS",
    "price": 1700,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 387,
    "name": "Butter Salted",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 85,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 388,
    "name": "Butter Unsalted",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 76,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 389,
    "name": "Choco Cips",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 89,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 390,
    "name": "Cocoa Powder",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 218,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 391,
    "name": "Cream Cheese",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 194,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 392,
    "name": "Cream Of Tartar",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 233,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 393,
    "name": "Cup Muffin",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 450,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 394,
    "name": "Dark Compound",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 81,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 395,
    "name": "Extract Vanila Jansen",
    "division": "PASTRY",
    "unit": "ML",
    "price": 371,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 396,
    "name": "Gelatin Bloom",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 260,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 397,
    "name": "Glucosa",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 16,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 398,
    "name": "Gold Label Whipping Cream",
    "division": "PASTRY",
    "unit": "ML",
    "price": 64,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 399,
    "name": "Gold Leaf",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 738,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 400,
    "name": "Gula Halus - Pastry",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 24,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 401,
    "name": "Icing Sugar",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 40,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 402,
    "name": "Kacang Mete",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 260,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 403,
    "name": "Millac Whipping Cream - Pastry",
    "division": "PASTRY",
    "unit": "ML",
    "price": 95,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 404,
    "name": "Nescafe Powder",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 589,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 405,
    "name": "Oreo Crumb",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 83,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 406,
    "name": "Palleta Selai Bluebarry",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 64,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 407,
    "name": "Palleta Selai Strawberry",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 51,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 408,
    "name": "Powder Indomilk Full Cream",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 133,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 409,
    "name": "Rab Custard",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 117,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 410,
    "name": "Ragi Farnipan",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 545,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 411,
    "name": "Ricoman Brown Sugar",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 111,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 412,
    "name": "Santan Instan - Pastry",
    "division": "PASTRY",
    "unit": "ML",
    "price": 55,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 413,
    "name": "Skippy Peanut Butter",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 142,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 414,
    "name": "Soda Kue Koe Poe",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 1000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 415,
    "name": "Sp Kue - Pastry",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 82,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 416,
    "name": "Sunpride KNovail (Buah Potong) 490gr",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 63,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 417,
    "name": "Swallow Agar-agar",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 786,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 418,
    "name": "Taffieco Pasta Green Tea",
    "division": "PASTRY",
    "unit": "ML",
    "price": 365,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 419,
    "name": "Taffieco Pasta Mangga",
    "division": "PASTRY",
    "unit": "ML",
    "price": 627,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 420,
    "name": "Taffieco Pasta Mocca",
    "division": "PASTRY",
    "unit": "ML",
    "price": 440,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 421,
    "name": "Taffieco Pasta Pandan",
    "division": "PASTRY",
    "unit": "ML",
    "price": 305,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 422,
    "name": "Taffieco Pasta Strawberry",
    "division": "PASTRY",
    "unit": "ML",
    "price": 380,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 423,
    "name": "Taffieco Pasta Vanila",
    "division": "PASTRY",
    "unit": "ML",
    "price": 365,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 424,
    "name": "Taffieco Rhum Bakar",
    "division": "PASTRY",
    "unit": "ML",
    "price": 551,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 425,
    "name": "Tatua Mascarpone",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 186,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 426,
    "name": "Tepung Cakra Kembar",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 12,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 427,
    "name": "Tepung Muffine Chocolate",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 71,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 428,
    "name": "Tepung Muffin Vanila",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 39,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 429,
    "name": "Tepung Sagutani",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 37,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 430,
    "name": "Tepung Terigu Kunci Biru",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 13,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 431,
    "name": "White Compound",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 95,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 432,
    "name": "Yogurt Plain",
    "division": "PASTRY",
    "unit": "GRAM",
    "price": 90,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 433,
    "name": "Es Kacang Merah",
    "division": "LAINNYA",
    "unit": "PACK",
    "price": 15000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 434,
    "name": "Ice Cream Cup",
    "division": "LAINNYA",
    "unit": "PCS",
    "price": 7500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 435,
    "name": "Ice Cream Lilin Polos",
    "division": "LAINNYA",
    "unit": "PCS",
    "price": 7125,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 436,
    "name": "Ice Cream Lilin Lapis",
    "division": "LAINNYA",
    "unit": "PCS",
    "price": 7500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 437,
    "name": "Kerupuk Putih_Bogasari",
    "division": "LAINNYA",
    "unit": "PCS",
    "price": 1500,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 438,
    "name": "Gula Merah",
    "division": "LAINNYA",
    "unit": "KG",
    "price": 30000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 439,
    "name": "Kecap Asin LEE KUM KEE",
    "division": "LAINNYA",
    "unit": "ML",
    "price": 28000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 440,
    "name": "Kerupuk Kembang Tahu",
    "division": "LAINNYA",
    "unit": "PACK",
    "price": 10000,
    "stock": 0,
    "minStock": 2
  },
  {
    "id": 441,
    "name": "Jamur Tiram Putih",
    "division": "LAINNYA",
    "unit": "KG",
    "price": 35000,
    "stock": 0,
    "minStock": 2
  }
];

const DEFAULT_SAMPLE_TRANSACTIONS = [
  {
    id: "TXN0001",
    itemId: 6,
    itemName: "Ayam Kampung",
    type: "IN",
    qty: 10,
    date: new Date().toISOString().split("T")[0],
    staff: "Chef Rina",
    notes: "Restock pasar pagi",
    division: "KITCHEN",
    unitPrice: 44000,
    totalRupiah: 440000
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DEFAULT_CATALOG_ITEMS, DEFAULT_SAMPLE_TRANSACTIONS };
}
