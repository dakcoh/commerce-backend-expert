package validation;

import jakarta.persistence.*;

@Entity
@Table(name="jpa_stock")
public class Stock {
    @Id public long id;
    public int quantity;
    @Version public long version;
    protected Stock() {}
    Stock(long id,int quantity){this.id=id;this.quantity=quantity;}
}
