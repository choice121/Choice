import rawData from './pipeline_properties.json';
import seedData from './mustang_seed.json';
import { Property } from '../types/property';

export const INITIAL_PIPELINE_PROPERTIES: Property[] = (rawData as unknown) as Property[];
export const MUSTANG_SEED_PROPERTIES: Property[] = (seedData as unknown) as Property[];
