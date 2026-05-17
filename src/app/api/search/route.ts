import { NextRequest, NextResponse } from 'next/server';
import { SearchFilters, SearchResult } from '@/types';
import { SearchAggregator } from '@/scrapers';

const aggregator = new SearchAggregator();

export async function POST(request: NextRequest) {
  try {
    const body: Partial<SearchFilters> = await request.json();

    // 基本驗證
    if (body.listingType && !['sale', 'rent', 'new'].includes(body.listingType)) {
      return NextResponse.json(
        { error: '無效的交易類型' },
        { status: 400 }
      );
    }

    const result: SearchResult = await aggregator.search(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: '搜尋失敗，請稍後再試' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: Partial<SearchFilters> = {
      listingType: (searchParams.get('listingType') as SearchFilters['listingType']) || 'sale',
      keyword: searchParams.get('keyword') || '',
      city: searchParams.get('city') || '',
      districts: searchParams.get('districts')?.split(',').filter(Boolean) || [],
      minPrice: Number(searchParams.get('minPrice')) || 0,
      maxPrice: Number(searchParams.get('maxPrice')) || 0,
      minSize: Number(searchParams.get('minSize')) || 0,
      maxSize: Number(searchParams.get('maxSize')) || 0,
      rooms: Number(searchParams.get('rooms')) || 0,
      hideSponsored: searchParams.get('hideSponsored') !== 'false',
      platforms: (searchParams.get('platforms')?.split(',').filter(Boolean) || []) as any,
      sortBy: (searchParams.get('sortBy') as SearchFilters['sortBy']) || 'default',
      propertyTypes: (searchParams.get('propertyTypes')?.split(',').filter(Boolean) || []) as any,
    };

    const result: SearchResult = await aggregator.search(filters);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: '搜尋失敗，請稍後再試' },
      { status: 500 }
    );
  }
}
