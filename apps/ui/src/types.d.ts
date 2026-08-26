declare interface Favorite {
  id: number;
  title: string;
  url: string;
  icon?: string;
}

declare interface UrlDetail {
  url: string;
  title: string;
}

interface ObjectConstructor {
  keys<T>(o: T): (keyof T)[];
}
