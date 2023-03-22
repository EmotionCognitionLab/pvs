class IntertaskIntervals:
    START_KEY = 'sk'
    END_KEY = 'ek'
    SET_KEY = 'set'
    
    def __init__(self):
        self.user_dict = {}

    def set_set(self, user_id, set):
        user_recs = self.user_dict.get(user_id, [])
        # if we don't already have an entry with this set number, add it
        # if we do have one, do nothing
        if len(list(filter(lambda x: x[self.SET_KEY] == set, user_recs))) == 0:
            user_recs.append({self.SET_KEY: set}) 
            self.user_dict[user_id] = user_recs

    def set_start_time(self, user_id, start_time):
        user_rec = self.user_dict[user_id][-1]
        user_rec[self.START_KEY] = start_time

    def set_end_time(self, user_id, end_time):
        user_rec = self.user_dict[user_id][-1]
        user_rec[self.END_KEY] = end_time

    def __str__(self):
        result = ""
        for (user_id, rec_list) in self.user_dict.items():
            for rec in rec_list:
                st = rec.get(self.START_KEY, False)
                et = rec.get(self.END_KEY, False)

                interval_secs = "N/A"
                if et and st:
                    interval_secs = int((et - st).total_seconds())
                result += f"{user_id}, {rec[self.SET_KEY]}, {interval_secs}\n"
        
        return result