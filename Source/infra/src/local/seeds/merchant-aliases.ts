export interface MerchantSeed {
  id: string;
  brand_name: string;
  country_code: string;
  default_category_id: string;
  website: string | null;
  aliases: string[];
}

export const merchantSeeds: MerchantSeed[] = [
  {
    id: '01900000-0001-7000-8000-000000000001',
    brand_name: 'Albert Heijn',
    country_code: 'NL',
    default_category_id: 'cat-groceries',
    website: 'https://www.ah.nl',
    aliases: ['ALBERT HEIJN', 'AH', 'AH TO GO', 'ALBERT HEIJN BV', 'AH ONLINE'],
  },
  {
    id: '01900000-0001-7000-8000-000000000002',
    brand_name: 'Jumbo',
    country_code: 'NL',
    default_category_id: 'cat-groceries',
    website: 'https://www.jumbo.com',
    aliases: ['JUMBO', 'JUMB', 'JUMBO SUPERMARKTEN', 'JUMBO SUPERMARKT'],
  },
  {
    id: '01900000-0001-7000-8000-000000000003',
    brand_name: 'Lidl',
    country_code: 'NL',
    default_category_id: 'cat-groceries',
    website: 'https://www.lidl.nl',
    aliases: ['LIDL', 'LIDL NEDERLAND', 'LIDL NEDERLAND BV'],
  },
  {
    id: '01900000-0001-7000-8000-000000000004',
    brand_name: 'Aldi',
    country_code: 'NL',
    default_category_id: 'cat-groceries',
    website: 'https://www.aldi.nl',
    aliases: ['ALDI', 'ALDI MARKT', 'ALDI NEDERLAND', 'ALDI SUPERMARKT'],
  },
  {
    id: '01900000-0001-7000-8000-000000000005',
    brand_name: 'Plus',
    country_code: 'NL',
    default_category_id: 'cat-groceries',
    website: 'https://www.plus.nl',
    aliases: ['PLUS', 'PLUS RETAIL', 'PLUS SUPERMARKT'],
  },
  {
    id: '01900000-0001-7000-8000-000000000006',
    brand_name: 'Dirk',
    country_code: 'NL',
    default_category_id: 'cat-groceries',
    website: 'https://www.dirk.nl',
    aliases: ['DIRK', 'DIRK VAN DEN BROEK', 'DIRK SUPERMARKT'],
  },
  {
    id: '01900000-0001-7000-8000-000000000007',
    brand_name: 'Kruidvat',
    country_code: 'NL',
    default_category_id: 'cat-personal-care',
    website: 'https://www.kruidvat.nl',
    aliases: ['KRUIDVAT', 'KRUIDVAT RETAIL', 'KRUIDVAT BV'],
  },
  {
    id: '01900000-0001-7000-8000-000000000008',
    brand_name: 'Etos',
    country_code: 'NL',
    default_category_id: 'cat-personal-care',
    website: 'https://www.etos.nl',
    aliases: ['ETOS', 'ETOS BV', 'ETOS DROGISTERIJ'],
  },
  {
    id: '01900000-0001-7000-8000-000000000009',
    brand_name: 'Trekpleister',
    country_code: 'NL',
    default_category_id: 'cat-personal-care',
    website: 'https://www.trekpleister.nl',
    aliases: ['TREKPLEISTER', 'TREKPLEISTER BV', 'TREKPLEISTER DROGIST'],
  },
  {
    id: '01900000-0001-7000-8000-000000000010',
    brand_name: 'HEMA',
    country_code: 'NL',
    default_category_id: 'cat-household',
    website: 'https://www.hema.nl',
    aliases: ['HEMA', 'HEMA BV', 'HEMA NEDERLAND'],
  },
  {
    id: '01900000-0001-7000-8000-000000000011',
    brand_name: 'Action',
    country_code: 'NL',
    default_category_id: 'cat-other',
    website: 'https://www.action.com',
    aliases: ['ACTION', 'ACTION NEDERLAND', 'ACTION BV'],
  },
];
